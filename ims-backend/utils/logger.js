const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const getLogsDirectory = () => {
  let logsDir;
  
  // In production (packaged app), store logs in userData folder
  if (process.env.NODE_ENV === 'production' || process.env.ELECTRON_APP === 'true') {
    // For Electron apps, use userData path
    const { app } = require('electron');
    if (app && app.getPath) {
      logsDir = path.join(app.getPath('userData'), 'logs');
    } else {
      // Fallback for when running from packaged app
      logsDir = path.join(process.cwd(), 'logs');
    }
  } else {
    // In development, store in project logs folder
    logsDir = path.join(__dirname, '../logs');
  }
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  return logsDir;
};

const logsDir = getLogsDirectory();

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      logMessage += `\nMetadata: ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  transports: [
    // Error logs - separate file for errors only
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    
    // All logs - combined file
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true
    }),
    
    // Application specific logs
    new DailyRotateFile({
      filename: path.join(logsDir, 'backend-app-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      level: 'debug'
    })
  ]
});

// Add console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Log uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, 'exceptions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d'
  })
);

logger.rejections.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, 'rejections-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d'
  })
);

// Helper functions for different log levels
const loggerHelpers = {
  // Standard logging methods
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  
  // Specific helper methods
  logRequest: (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const logData = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      };
      
      if (res.statusCode >= 400) {
        logger.error(`HTTP ${req.method} ${req.url}`, logData);
      } else {
        logger.info(`HTTP ${req.method} ${req.url}`, logData);
      }
    });
    
    if (next) next();
  },
  
  logError: (error, context = '') => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString()
    };
    logger.error(`Error occurred: ${context}`, errorData);
  },
  
  logDatabaseOperation: (operation, table, data = {}) => {
    logger.info(`Database operation: ${operation} on ${table}`, {
      operation,
      table,
      data: typeof data === 'object' ? JSON.stringify(data) : data
    });
  },
  
  logServerStart: (port, environment = process.env.NODE_ENV) => {
    logger.info(`🚀 Server started successfully`, {
      port,
      environment,
      logsDirectory: logsDir,
      timestamp: new Date().toISOString()
    });
  },
  
  logServerStop: () => {
    logger.info('🛑 Server shutting down', {
      timestamp: new Date().toISOString()
    });
  }
};

// Export both the winston logger and helper functions
module.exports = {
  logger,
  ...loggerHelpers,
  logsDir
};