import { getEnv } from './config/env.js';
import { logger } from './logger/index.js';
import { discordBot } from './discord/client.js';
import { roleBackupRepository } from './persistence/roleBackupRepository.js';
import { warnRepository } from './persistence/warnRepository.js';
import { suspensionScheduler } from './scheduler/suspensionScheduler.js';
import { createHttpServer } from './http/server.js';
import { timeoutScheduler } from './services/timeoutScheduler.js';

async function main() {
  logger.info('Starting Hyori Discord Bot service...');
  const env = getEnv();
  logger.info(
    {
      nodeEnv: env.NODE_ENV,
      port: env.HTTP_PORT,
      host: env.HTTP_HOST,
    },
    'Configuration validated'
  );
  await roleBackupRepository.init();
  await warnRepository.init();
  logger.info('Persistence storage initialized');

  discordBot.start().then(() => {
    timeoutScheduler.start(discordBot.client);
  }).catch(error => {
    logger.error(
      {
        error,
      },
      'Failed to connect to Discord Gateway. Running HTTP server in degraded mode...'
    );
  });

  suspensionScheduler.start();
  const server = await createHttpServer();
  await server.listen({
    port: env.HTTP_PORT,
    host: env.HTTP_HOST,
  });
  logger.info(
    `🚀 Hyori Discord Bot HTTP server listening at http://${env.HTTP_HOST}:${env.HTTP_PORT}/api/v1`
  );

  let isShuttingDown = false;
  const shutdown = async signal => {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, ignoring duplicate signal');
      return;
    }
    isShuttingDown = true;

    logger.info(
      {
        signal,
      },
      'Graceful shutdown initiated...'
    );

    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out (10s), forcing exit');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
      timeoutScheduler.stop();
    } catch (err) {
      logger.error({ err }, 'Error stopping timeout scheduler');
    }

    try {
      suspensionScheduler.stop();
    } catch (err) {
      logger.error({ err }, 'Error stopping suspension scheduler');
    }

    try {
      await server.close();
      logger.info('HTTP server closed');
    } catch (err) {
      logger.error(
        {
          err,
        },
        'Error closing HTTP server'
      );
    }

    try {
      await discordBot.stop();
      logger.info('Discord client disconnected');
    } catch (err) {
      logger.error(
        {
          err,
        },
        'Error closing Discord client'
      );
    }

    logger.info('Hyori Discord Bot shutdown complete');
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', error => {
    logger.fatal(
      {
        error,
      },
      'Uncaught Exception in process'
    );
  });
  process.on('unhandledRejection', reason => {
    logger.error(
      {
        reason,
      },
      'Unhandled Promise Rejection'
    );
  });
}
main().catch(error => {
  logger.fatal(
    {
      error,
    },
    'Fatal error during Hyori Discord Bot startup'
  );
  process.exit(1);
});
