import { buildApp } from './app.js';
import { logger } from './utils/logger.js';

const start = async () => {
  try {
    const app = await buildApp();

    // Start the server
    await app.listen({
      port: app.config.PORT,
      host: app.config.HOST,
    });

    logger.info(`Server listening at http://${app.config.HOST}:${app.config.PORT}`);
    logger.info(
      `API available at http://${app.config.HOST}:${app.config.PORT}${app.config.API_PREFIX}/${app.config.API_VERSION}`
    );

    if (app.config.SWAGGER_ENABLED) {
      logger.info(
        `Documentation available at http://${app.config.HOST}:${app.config.PORT}${app.config.SWAGGER_PATH}`
      );
    }

    if (app.config.METRICS_ENABLED) {
      logger.info(
        `Metrics available at http://${app.config.HOST}:${app.config.PORT}${app.config.METRICS_PATH}`
      );
    }
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('SIGINT signal received');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received');
  process.exit(0);
});

// Start the server
start();
