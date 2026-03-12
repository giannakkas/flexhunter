// ==============================================
// Structured Logger
// ==============================================
// JSON-formatted logging for production observability.
// Falls back to pretty console output in development.

const IS_PROD = process.env.NODE_ENV === 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: any;
}

function formatLog(level: LogLevel, msg: string, meta?: Record<string, any>): LogEntry {
  return {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

function write(entry: LogEntry) {
  if (IS_PROD) {
    // JSON lines format for log aggregators (Railway, Datadog, etc.)
    const line = JSON.stringify(entry);
    if (entry.level === 'error' || entry.level === 'fatal') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  } else {
    // Pretty format for development
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', fatal: '\x1b[35m',
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level] || '';
    const { level, msg, timestamp, ...rest } = entry;
    const extra = Object.keys(rest).length > 0 ? ' ' + JSON.stringify(rest) : '';
    console.log(`${color}[${level.toUpperCase()}]${reset} ${msg}${extra}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, any>) => write(formatLog('debug', msg, meta)),
  info: (msg: string, meta?: Record<string, any>) => write(formatLog('info', msg, meta)),
  warn: (msg: string, meta?: Record<string, any>) => write(formatLog('warn', msg, meta)),
  error: (msg: string, meta?: Record<string, any>) => write(formatLog('error', msg, meta)),
  fatal: (msg: string, meta?: Record<string, any>) => write(formatLog('fatal', msg, meta)),

  // Request logger middleware
  requestLogger: () => {
    return (req: any, res: any, next: any) => {
      const start = Date.now();
      const originalEnd = res.end;

      res.end = function (...args: any[]) {
        const duration = Date.now() - start;
        const entry: Record<string, any> = {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
        };

        // Only log slow requests or errors in production
        if (IS_PROD) {
          if (res.statusCode >= 400 || duration > 5000) {
            logger.warn('request', entry);
          }
        } else {
          // Log all in dev (skip health checks)
          if (req.path !== '/health' && !req.path.includes('favicon')) {
            const lvl = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
            logger[lvl]('request', entry);
          }
        }

        originalEnd.apply(res, args);
      };

      next();
    };
  },
};

export default logger;
