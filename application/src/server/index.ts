import * as express from 'express';
import URI from 'urijs';

import config from '../config';

import * as recorder from '../model/recorder';

import logger from '../service/logger';

export const startWebServer = async ():Promise<void> => {
  const app = express.default();

  app.get('/', (req, res) => res.send('Server is running.'));

  app.get('/gpu', async (req, res) => {
    try {
      const html = await recorder.runGpuTest();

      res.status(200).send(html);
    } catch (error) {
      res.status(500).send(error);
    }
  });

  app.get('/benchmark', async (req, res) => {
    try {
      const screenshot = await recorder.runBenchmark();

      res.sendFile(screenshot);
    } catch (error) {
      res.status(500).send(error);
    }
  });

  app.get('/record', async (req, res) => {
    const url = req.query['url'] as string;

    if (!url) {
      res.status(400).send('URL is not provided.');
      return;
    }

    const uri = URI(url);

    if (!uri.is('absolute') || !uri.is('url') || !uri.is('domain')) {
      res.status(400).send('Unsupported URL format.');
      return;
    }

    if (uri.protocol() !== 'http' && uri.protocol() !== 'https') {
      res.status(400).send('Unsupported URL protocol.');
      return;
    }

    if (uri.hostname() === 'localhost' || uri.hostname().includes('amazon')) {
      res.status(400).send('Unsupported URL domain.');
      return;
    }

    const recording = await recorder.recordUrl(url);

    res.sendFile(recording);
  });

  await new Promise((resolve, reject) => {
    const server = app.listen(config.port, () => {
      logger.debug(`Web server has started on port ${config.port}`);
      resolve(null);
    });
    server.setTimeout(5 * 60 * 1000);

    server.on('error', reject);
  });
};
