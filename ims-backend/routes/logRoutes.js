const express = require('express');
const { logger, logError } = require('../utils/logger');
const router = express.Router();

// Endpoint to receive client-side logs
router.post('/client', (req, res) => {
  try {
    const { logs } = req.body;
    
    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: 'Logs must be an array' });
    }
    
    // Process each log entry
    logs.forEach(logEntry => {
      const { level, message, timestamp, url, userAgent, meta } = logEntry;
      
      // Create a comprehensive log message
      const logMessage = `[CLIENT] ${message}`;
      const logMeta = {
        client: true,
        originalTimestamp: timestamp,
        url,
        userAgent,
        meta
      };
      
      // Log based on level
      switch (level) {
        case 'error':
          logger.error(logMessage, logMeta);
          break;
        case 'warn':
          logger.warn(logMessage, logMeta);
          break;
        case 'info':
          logger.info(logMessage, logMeta);
          break;
        case 'debug':
          logger.debug(logMessage, logMeta);
          break;
        default:
          logger.info(logMessage, logMeta);
      }
    });
    
    res.status(200).json({ 
      message: 'Logs received successfully',
      count: logs.length 
    });
    
  } catch (error) {
    logError(error, 'Processing client logs');
    res.status(500).json({ error: 'Failed to process logs' });
  }
});

// Endpoint to get log files list (for admin/debugging)
router.get('/files', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { logsDir } = require('../utils/logger');
    
    if (!fs.existsSync(logsDir)) {
      return res.json({ files: [] });
    }
    
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log'))
      .map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime,
          path: filePath
        };
      })
      .sort((a, b) => b.modified - a.modified);
    
    res.json({ 
      files,
      logsDirectory: logsDir 
    });
    
  } catch (error) {
    logError(error, 'Getting log files list');
    res.status(500).json({ error: 'Failed to get log files' });
  }
});

// Endpoint to read a specific log file (for admin/debugging)
router.get('/file/:filename', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { logsDir } = require('../utils/logger');
    const { filename } = req.params;
    const { lines = 100, tail = true } = req.query;
    
    // Security: only allow .log files and prevent path traversal
    if (!filename.endsWith('.log') || filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(logsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const allLines = content.split('\n');
    
    let resultLines;
    if (tail === 'true') {
      // Get last N lines
      resultLines = allLines.slice(-parseInt(lines));
    } else {
      // Get first N lines
      resultLines = allLines.slice(0, parseInt(lines));
    }
    
    res.json({
      filename,
      lines: resultLines.filter(line => line.trim() !== ''),
      totalLines: allLines.length,
      fileSize: fs.statSync(filePath).size
    });
    
  } catch (error) {
    logError(error, `Reading log file: ${req.params.filename}`);
    res.status(500).json({ error: 'Failed to read log file' });
  }
});

module.exports = router;