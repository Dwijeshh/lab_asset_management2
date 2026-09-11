// Secure logging that doesn't expose sensitive data

export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

function log(level: LogLevel, message: string, context?: Record<string, any>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  // In production, send to logging service (e.g., Sentry, LogRocket, CloudWatch)
  if (process.env.NODE_ENV === 'production') {
    // Don't log to console in production to avoid exposing sensitive data
    // Instead, send to your logging service
    // Example: sendToLoggingService(entry);
    return;
  }

  // Development logging
  const formattedMessage = `[${entry.timestamp}] ${level}: ${message}`;
  
  switch (level) {
    case LogLevel.ERROR:
      console.error(formattedMessage, context || '');
      break;
    case LogLevel.WARN:
      console.warn(formattedMessage, context || '');
      break;
    case LogLevel.INFO:
      console.info(formattedMessage, context || '');
      break;
    case LogLevel.DEBUG:
      console.debug(formattedMessage, context || '');
      break;
  }
}

export const logger = {
  error: (message: string, context?: Record<string, any>) => 
    log(LogLevel.ERROR, message, context),
  
  warn: (message: string, context?: Record<string, any>) => 
    log(LogLevel.WARN, message, context),
  
  info: (message: string, context?: Record<string, any>) => 
    log(LogLevel.INFO, message, context),
  
  debug: (message: string, context?: Record<string, any>) => 
    log(LogLevel.DEBUG, message, context),
};

// Sanitize error for client response
export function sanitizeError(error: unknown): string {
  if (process.env.NODE_ENV === 'production') {
    // Never expose error details in production
    return 'An error occurred';
  }

  // Development mode - can show more details
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unknown error occurred';
}