import * as genericPool from 'generic-pool';
import puppeteer from 'puppeteer';

import config from '../../config';

import logger from '../logger';
import resource from '../resource';

import { DisplayPool, DisplayResource } from './display';

export type Browser = puppeteer.Browser;
export type BrowserPage = puppeteer.Page;
export type BrowserPool = genericPool.Pool<BrowserProvider>;

export interface IBrowserOptions {
  width:number;
  height:number;
  url:string;
}

interface IBrowserProviderOptions {
  canvas?:DisplayResource;
}

export class BrowserProvider {
  public isInvalid:boolean = false;
  public display?:string;
  public options?:IBrowserOptions;
  public readonly canvas?:DisplayResource;

  private readonly cfg:(typeof config.chrome | typeof config.chrome_debug);
  private browser?:Browser;
  private page?:BrowserPage;

  constructor(
    opts:IBrowserProviderOptions,
  ) {
    if (opts.canvas) {
      this.display = opts.canvas.displayNumber;
      this.cfg = config.chrome;
    } else {
      this.cfg = config.chrome_debug;
    }

    this.canvas = opts.canvas;
  }

  public async initialize():Promise<any> {
    try {
      this.browser = await puppeteer.launch({
        headless: !this.display,
        args: this.cfg.flags,
        dumpio: config.is_debug,
        ignoreDefaultArgs: this.cfg.disabled_flags,
        timeout: this.cfg.timeout * 1000,
        env: {
          ...(this.display ? {
            DISPLAY: this.display,
          } : {}),
        },
        defaultViewport: null,
      });

      this.browser.on('disconnected', (error) => {
        logger.error({ error, display: this.display }, 'Browser disconnected.');
        this.isInvalid = true;
      });

      logger.debug({
        display: this.display,
      }, 'Browser started.');
    } catch (error) {
      this.isInvalid = true;
      throw error;
    }
  }

  public async dispose() {
    this.isInvalid = true;

    if (this.page) {
      try {
        await this.page.close({ runBeforeUnload: false });
      } catch (error) {
        logger.warn({ error, display: this.display }, 'Page close error.');
      }

      this.page = undefined;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        logger.error({ error, display: this.display }, 'Browser close error.');
      }

      this.browser = undefined;
    }
  }

  public async getPage(options:IBrowserOptions):Promise<BrowserPage> {
    if (!this.browser) {
      throw new Error('Not initialized.');
    }

    this.options = options;

    const page = await this.browser.newPage();
    this.page = page;

    await page.setViewport({
      width: options.width,
      height: options.height,
    });

    await page.goto(options.url, {
      waitUntil: 'networkidle2',
      timeout: config.chrome.timeout * 1000,
    });

    logger.debug({ url: options.url, display: this.display }, 'Page created.');

    return page;
  }

  public async disposePage():Promise<any> {
    const { page, display } = this;

    if (!page) {
      throw new Error('Page has not been created.');
    }

    try {
      page.removeAllListeners();
      await page.close();
    } catch (error) {
      logger.error({ error, display }, 'Page close error.');
    }

    this.options = undefined;
    this.page = undefined;
  }
}

export const initBrowser = async (
  displayPool?:DisplayPool,
):Promise<BrowserPool> => {
  const pool = genericPool.createPool({
    create: async () => {
      const canvas = displayPool
        ? await displayPool.acquire()
        : undefined;
      const instance = new BrowserProvider({
        canvas,
      });

      await instance.initialize();

      return instance;
    },
    destroy: async (instance:BrowserProvider) => {
      const { canvas } = instance;

      try {
        await instance.dispose();
      } catch (error) {
        logger.error({ error, display: canvas?.displayNumber }, 'Browser dispose error.');

        resource.requestShudown();
      }

      if (canvas && displayPool) {
        try {
          await displayPool.release(canvas);
        } catch (error) {
          logger.error({ error, display: canvas.displayNumber }, 'Display release error.');

          resource.requestShudown();
        }
      }
    },
    validate: async (instance:BrowserProvider) => {
      return !instance.isInvalid;
    },
  }, {
    max: config.recorder.concurrency,
    min: config.recorder.concurrency,
    acquireTimeoutMillis: displayPool
      ? config.chrome.timeout * 1000
      : config.chrome_debug.timeout * 1000,
    testOnBorrow: true,
  });

  pool.on('factoryCreateError', (error) => {
    logger.error({ error: error.message }, 'Browser create error.');

    resource.requestShudown();
  });

  pool.on('factoryDestroyError', (error) => {
    logger.error({ error }, 'Browser destroy error.');

    resource.requestShudown();
  });

  pool.start();

  const provider = await pool.acquire();

  await pool.release(provider);

  return pool;
};
