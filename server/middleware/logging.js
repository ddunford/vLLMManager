const winston = require('winston');
const morgan = require('morgan');
const path = require('path');

// Create logs directory if it doesn't exist (with error handling)
const fs = require('fs');
const logsDir = path.join(__dirname, '../logs');
let logsDirectoryAvailable = true;

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  console.warn('Warning: Unable to create logs directory:', error.message);
  console.warn('Logging to files will be disabled, using console only');
  logsDirectoryAvailable = false;
}

// Winston logger configuration
const transports = [];

// Add file transports only if logs directory is available
if (logsDirectoryAvailable) {
  transports.push(
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'vllm-manager' },
  transports: transports,
});

// If we're not in production, log to console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Morgan middleware for HTTP request logging
const httpLogger = morgan('combined', {
  stream: {
    write: (message) => {
      logger.info(message.trim());
    }
  }
});

// Morgan middleware for development
const devLogger = morgan('dev');

// Security-focused logging middleware
const securityLogger = (req, res, next) => {
  // Log potential security issues
  const suspiciousPatterns = [
    /\.\./,  // Directory traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript injection
  ];

  const url = req.originalUrl || req.url;
  const userAgent = req.get('User-Agent') || '';
  
  suspiciousPatterns.forEach(pattern => {
    if (pattern.test(url) || pattern.test(userAgent)) {
      logger.warn('Suspicious request detected', {
        ip: req.ip,
        url: url,
        userAgent: userAgent,
        method: req.method,
        headers: req.headers,
        pattern: pattern.toString(),
      });
    }
  });

  next();
};

// Function to log sensitive operations
const logSensitiveOperation = (operation, userId, details = {}) => {
  logger.info('Sensitive operation performed', {
    operation,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  });
};

module.exports = {
  logger,
  httpLogger,
  devLogger,
  securityLogger,
  logSensitiveOperation,
}; 