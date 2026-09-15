// Client-side logger for React application
// This will send logs to the backend API for centralized logging

interface LogLevel {
  DEBUG: string;
  INFO: string;
  WARN: string;
  ERROR: string;
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
  stack?: string;
  meta?: any;
}

class ClientLogger {
  private isProduction: boolean;
  private apiEndpoint: string;
  private logQueue: LogEntry[] = [];
  private maxQueueSize: number = 100;
  private flushInterval: number = 5000; // 5 seconds

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.apiEndpoint = '/api/logs/client';
    
    // Start auto-flush timer
    setInterval(() => this.flushLogs(), this.flushInterval);
    
    // Flush logs on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flushLogs());
      
      // Capture unhandled errors
      window.addEventListener('error', (event) => {
        this.error('Unhandled Error', {
          message: event.error?.message || event.message,
          stack: event.error?.stack,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });
      
      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled Promise Rejection', {
          reason: event.reason,
          stack: event.reason?.stack
        });
      });
    }
  }

  private createLogEntry(level: string, message: string, meta?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      meta: meta || {}
    };
  }

  private addToQueue(logEntry: LogEntry): void {
    this.logQueue.push(logEntry);
    
    // Keep queue size under control
    if (this.logQueue.length > this.maxQueueSize) {
      this.logQueue = this.logQueue.slice(-this.maxQueueSize);
    }
    
    // Auto-flush on errors or if queue is full
    if (logEntry.level === LOG_LEVELS.ERROR || this.logQueue.length >= this.maxQueueSize) {
      this.flushLogs();
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logQueue.length === 0) return;
    
    const logsToSend = [...this.logQueue];
    this.logQueue = [];
    
    try {
      // Send logs to backend
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ logs: logsToSend })
      });
      
      if (!response.ok) {
        console.error('Failed to send logs to server:', response.statusText);
        // Put logs back in queue on failure
        this.logQueue = [...logsToSend, ...this.logQueue];
      }
    } catch (error) {
      console.error('Error sending logs to server:', error);
      // Put logs back in queue on failure
      this.logQueue = [...logsToSend, ...this.logQueue];
    }
  }

  debug(message: string, meta?: any): void {
    const logEntry = this.createLogEntry(LOG_LEVELS.DEBUG, message, meta);
    
    if (!this.isProduction) {
      console.log(`[DEBUG] ${message}`, meta || '');
    }
    
    this.addToQueue(logEntry);
  }

  info(message: string, meta?: any): void {
    const logEntry = this.createLogEntry(LOG_LEVELS.INFO, message, meta);
    
    if (!this.isProduction) {
      console.info(`[INFO] ${message}`, meta || '');
    }
    
    this.addToQueue(logEntry);
  }

  warn(message: string, meta?: any): void {
    const logEntry = this.createLogEntry(LOG_LEVELS.WARN, message, meta);
    
    console.warn(`[WARN] ${message}`, meta || '');
    this.addToQueue(logEntry);
  }

  error(message: string, meta?: any): void {
    const logEntry = this.createLogEntry(LOG_LEVELS.ERROR, message, meta);
    
    console.error(`[ERROR] ${message}`, meta || '');
    this.addToQueue(logEntry);
  }

  // Helper methods for specific scenarios
  logUserAction(action: string, details?: any): void {
    this.info(`User Action: ${action}`, {
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }

  logApiCall(method: string, url: string, status: number, duration: number): void {
    const level = status >= 400 ? LOG_LEVELS.ERROR : LOG_LEVELS.INFO;
    const logEntry = this.createLogEntry(level, `API Call: ${method} ${url}`, {
      method,
      url,
      status,
      duration: `${duration}ms`
    });
    
    if (!this.isProduction || level === LOG_LEVELS.ERROR) {
      console[level === LOG_LEVELS.ERROR ? 'error' : 'log'](`[API] ${method} ${url} - ${status} (${duration}ms)`);
    }
    
    this.addToQueue(logEntry);
  }

  logNavigationChange(from: string, to: string): void {
    this.info('Navigation Change', {
      from,
      to,
      timestamp: new Date().toISOString()
    });
  }

  logPerformance(name: string, duration: number, details?: any): void {
    this.info(`Performance: ${name}`, {
      name,
      duration: `${duration}ms`,
      ...details
    });
  }

  // Force flush logs immediately
  async flush(): Promise<void> {
    await this.flushLogs();
  }
}

// Create singleton instance
const logger = new ClientLogger();

export default logger;
export { LOG_LEVELS };
export type { LogEntry };