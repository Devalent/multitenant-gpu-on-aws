import { ChildProcess } from 'child_process';
import execa from 'execa';
import * as genericPool from 'generic-pool';

import config from '../../config';

import logger from '../logger';
import resource from '../resource';

import Xvfb from '../xvfb';

export type DisplayPool = genericPool.Pool<DisplayResource>;

export class DisplayResource {
  constructor(
    private process,
    private cursor:ChildProcess,
    private wm:ChildProcess,
    private display:string,
  ) {}

  get displayNumber():string {
    return this.display;
  }

  public async dispose() {
    if (this.cursor) {
      this.cursor.kill();
    }

    if (this.wm) {
      this.wm.kill();
    }

    if (this.process) {
      await new Promise((resolve, reject) => {
        this.process.stop((error) => {
          if (error) {
            reject(error);
          } else {
            resolve(undefined);
          }
        });
      });
    }
  }
}

class DisplayProvider {
  public async create():Promise<DisplayResource> {
    const item = await new Promise<any>((resolve, reject) => {
      const xvfb = new Xvfb({
        reuse: false,
        xvfb_args: [
          '-screen', '0', `${config.recorder.max_width}x${config.recorder.max_height}x24+32`,
          '+extension', 'RANDR',
          '+extension', 'GLX',
          '-nolisten', 'tcp',
          '-dpi', '96',
          '-ac',
          '-noreset',
        ],
      });
      xvfb.start((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(xvfb);
      });
    });
    const display:string = item.display();

    const wm = execa('fluxbox', [], {
      env: { DISPLAY: display },
    });

    const cursor = execa('unclutter', [
      '-idle', '0',
    ], {
      env: { DISPLAY: display },
    });

    logger.debug({ display }, 'Display created.');

    return new DisplayResource(item, cursor, wm, display);
  }
}

export const initDisplays = async ():Promise<DisplayPool | null> => {
  // if (config.is_debug) {
  //   return null;
  // }

  const displayProviderPool = genericPool.createPool<DisplayProvider>({
    create: async () => {
      return new DisplayProvider();
    },
    destroy: async (instance:any) => {},
  }, {
    max: 1,
    min: 0,
    acquireTimeoutMillis: config.chrome.timeout * 1000,
  });

  displayProviderPool.start();

  const displayPool = genericPool.createPool({
    create: async () => {
      const provider:DisplayProvider = await displayProviderPool.acquire();

      const display = await provider.create();

      await displayProviderPool.release(provider);

      return display;
    },
    destroy: async (instance:DisplayResource) => {
      // await instance.dispose();
    },
    validate: async (instance:DisplayResource) => {
      return true;
    },
  }, {
    max: config.recorder.concurrency,
    min: config.recorder.concurrency,
    acquireTimeoutMillis: config.chrome.timeout * 1000,
    testOnBorrow: true,
  });

  displayPool.on('factoryCreateError', (error) => {
    logger.error({ error }, 'Display create error.');

    resource.requestShudown();
  });

  displayPool.on('factoryDestroyError', (error) => {
    logger.error({ error }, 'Display destroy error.');
  });

  displayPool.start();

  return displayPool;
};
