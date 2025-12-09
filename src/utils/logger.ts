import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL ?? 'info';

// Create logger instance
export const logger = pino({
  level: logLevel,
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname,reqId,responseTime,req,res',
          colorize: true,
          singleLine: true,
          messageFormat: '{msg}',
        },
      },
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  serializers: {
    req: (req: { method?: string; url?: string }) => ({
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode?: number }) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
  base: isProduction
    ? {
        env: process.env.NODE_ENV,
        revision: process.env.COMMIT_SHA ?? 'unknown',
      }
    : undefined,
});

// Create child loggers for specific modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};
