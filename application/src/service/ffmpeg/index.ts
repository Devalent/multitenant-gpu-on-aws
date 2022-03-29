import * as temp from 'temp';

import config from '../../config';

import logger from '../logger';

import { FfmpegProcess } from './ffmpeg';

export type RecorderInput = {
  width:number;
  height:number;
  display:string;
};

export class Recorder {
  private readonly filepath:string;
  private process?:FfmpegProcess;
  private errorPromise?:Promise<any>;

  constructor(
    private readonly input:RecorderInput,
  ) {
    this.filepath = temp.path({ suffix: '.' + config.ffmpeg.format });
  }

  public async start():Promise<void> {
    const inputOptions = config.is_debug
      ? config.recorder.ffmpeg_debug.in
      : config.recorder.ffmpeg.in;
    const outputOptions = config.is_debug
      ? config.recorder.ffmpeg_debug.out
      : config.recorder.ffmpeg.out;

    const args = [
      '-y', '-hide_banner',
      '-f', 'x11grab',
    ]
      .concat(inputOptions.split(' ').filter(x => x !== ''))
      .concat([
        '-s', `${this.input.width}x${this.input.height}`,
        '-i', `${this.input.display}.0`,
      ])
      .concat(outputOptions.split(' ').filter(x => x !== ''))
      .concat([ this.filepath ]);

    logger.debug({ ffmpeg: args.join(' ') }, 'Launching FFMPEG...');

    const proc = this.process = new FfmpegProcess(args);

    this.errorPromise = new Promise((resolve, reject) => {
      proc.once('ended', () => {
        const { error, output } = proc;

        if (error) {
          logger.error({ error, output }, 'FFMPEG recorder error.');
          reject(error);
        } else {
          logger.debug({ output }, 'FFMPEG recorder ended.');
          resolve(undefined);
        }
      });
    });

    await this.process.start();
  }

  public async awaitError():Promise<void> {
    if (!this.errorPromise) {
      throw new Error('Recording not started.');
    }

    return this.errorPromise;
  }

  public async stop():Promise<string> {
    if (this.process) {
      try {
        await this.process.stop();
      } finally {
        this.process = undefined;
      }
    }

    return this.filepath;
  }

  public async dispose():Promise<void> {
    await this.stop();
  }
}
