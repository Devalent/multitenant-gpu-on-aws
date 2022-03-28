import * as Bluebird from 'bluebird';
import * as express from 'express';
import * as temp from 'temp';

import config from '../config';
import * as browser from '../service/browser';
import logger from '../service/logger';
import resource from '../service/resource';

export const startWebServer = async ():Promise<void> => {
  const app = express.default();

  app.get('/', (req, res) => res.send('Server is running.'));

  app.get('/gpu', (req, res) => {
    browser.runPage({
      width: 1280,
      height: 720,
      url: 'chrome://gpu',
    }, async ({ page }) => {
      const html = await page.content();

      res.status(200).send(html);
    })
      .catch((error) => res.status(500).send(error));
  });

  app.get('/benchmark', (req, res) => {
    browser.runPage({
      width: 1920,
      height: 1080,
      url: 'https://web.basemark.com/',
    }, async ({ page }) => {
      await page.click('#start');

      let timeout;

      try {
        await Bluebird.race([
          new Promise((resolve) => {
            timeout = setInterval(async () => {
              if (page.url().startsWith('https://web.basemark.com/result')) {
                resolve(undefined);
              }
            }, 1000);
          }),
          resource.createTimeout(5 * 60 * 1000, 'benchmark').run(),
        ]);
      } finally {
        clearTimeout(timeout);
      }

      const screenshot = temp.path({ suffix: '.jpeg' });

      await page.screenshot({
        path: screenshot,
        fullPage: true,
        type: 'jpeg',
        quality: 30,
      });

      res.sendFile(screenshot);
    })
      .catch((error) => res.status(500).send(error));
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
