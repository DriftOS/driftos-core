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
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
          colorize: true,
          singleLine: false,
        },
      },
  formatters: {
    level: (label: string) => {
      return { level: label.toUpperCase() };
    },
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  base: {
    env: process.env.NODE_ENV,
    revision: process.env.COMMIT_SHA ?? 'unknown',
  },
});

// Create child loggers for specific modules
export const createLogger = (module: string) => {
  return logger.child({ module });
};
