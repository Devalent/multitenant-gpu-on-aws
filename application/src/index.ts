import { startWebServer } from './server';

import * as browser from './service/browser';
import logger from './service/logger';

const start = async () => {
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception.');
    process.exit(1);
  });

  logger.debug('Starting the server...');

  await browser.initialize();

  await startWebServer();
};

start()
  .then(() => {
    logger.debug('Server has started.');
  })
  .catch((error) => {
    logger.fatal({ error }, 'Unable to start the server.');
    process.exit(1);
  });
