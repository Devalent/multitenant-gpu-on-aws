import logger from '../logger';

import {
  BrowserPage,
  BrowserPool,
  BrowserProvider,
  IBrowserOptions,
  initBrowser,
} from './page';
import { DisplayPool, initDisplays } from './display';

export { BrowserPage, IBrowserOptions } from './page';

let displayPool:DisplayPool | undefined | null;
let browserPool:BrowserPool | undefined;

export const runPage = async <T = any>(
  options:IBrowserOptions,
  handler:(providers:{
    page:BrowserPage;
    display?:string;
  }) => Promise<T>,
):Promise<T> => {
  if (!browserPool) {
    throw new Error('Not initialized.');
  }

  const provider:BrowserProvider = await browserPool.acquire();

  try {
    try {
      const page = await provider.getPage(options);
      const { display } = provider;

      return await handler({
        page,
        display,
      });
    } finally {
      try {
        await provider.disposePage();
      } catch (error) {
        logger.error({ error }, 'Page dispose error.');
      }
    }
  } finally {
    try {
      await browserPool.release(provider);
    } catch (error) {
      logger.error({ error }, 'Browser release error.');
    }
  }
};

export const initialize = async () => {
  displayPool = await initDisplays();
  browserPool = await initBrowser(displayPool || undefined);

  await runPage({
    width: 1280,
    height: 720,
    url: 'chrome://gpu',
  }, async () => {
    logger.debug('Browser tested.');
  });
};

export const dispose = async () => {
  if (browserPool) {
    try {
      await browserPool.drain();
      await browserPool.clear();
    } catch (error) {
      logger.error({ error }, 'Browser pool shutdown error.');
    }

    browserPool = undefined;
  }

  if (displayPool) {
    try {
      await displayPool.drain();
      await displayPool.clear();
    } catch (error) {
      logger.error({ error }, 'Display pool shutdown error.');
    }

    displayPool = undefined;
  }
};
