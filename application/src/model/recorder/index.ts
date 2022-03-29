import * as temp from 'temp';

import * as browser from '../../service/browser';
import { Recorder } from '../../service/ffmpeg';
import resource from '../../service/resource';

export const runGpuTest = async () => {
  return await browser.runPage({
    width: 1280,
    height: 720,
    url: 'chrome://gpu',
  }, async ({ page }) => {
    return await page.content();
  });
};

export const runBenchmark = async () => {
  return await browser.runPage({
    width: 1920,
    height: 1080,
    url: 'https://web.basemark.com/',
  }, async ({ page }) => {
    await page.click('#start');

    let timeout;

    try {
      await Promise.race([
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

    return screenshot;
  });
};

export type RecordOptions = {
  url:string;
  width:number;
  height:number;
  duration:number;
};

export const recordUrl = async (opts:RecordOptions) => {
  const { url, width, height, duration } = opts;

  return await browser.runPage({ url, width, height }, async ({ page, display }) => {
    if (!display) {
      throw new Error('No display provided.');
    }

    const recorder = new Recorder({ width, height, display });

    try {
      await recorder.start();

      await Promise.race([
        recorder.awaitError(),
        new Promise((r) => setTimeout(r, duration * 1000)),
      ]);

      const filepath = await recorder.stop();

      return filepath;
    } finally {
      await recorder.dispose();
    }
  });
};
