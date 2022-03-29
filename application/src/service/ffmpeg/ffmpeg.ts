import * as Bluebird from 'bluebird';
import {
  spawn,
  ChildProcessWithoutNullStreams,
} from 'child_process';
import { EventEmitter } from 'events';

import config from '../../config';

const FFMPEG_START = 'Press [q] to stop, [?] for help';

export class FfmpegProcess extends EventEmitter {
  public output:string = '';
  public ended:boolean = false;
  public error?:Error;

  private process?:ChildProcessWithoutNullStreams;
  private timeoutId?:NodeJS.Timeout;

  constructor(
    private args:string[],
  ) {
    super();
  }

  public async start():Promise<any> {
    if (this.process) {
      throw new Error('Already started.');
    }

    this.process = spawn('ffmpeg', this.args, {
      detached: false,
    });

    this.timeoutId = setTimeout(() => {
      this.process?.kill('SIGABRT');
    }, config.ffmpeg.timeout * 1000);

    const handleStdio = (data:any) => {
      const payload = data.toString('utf-8');
      this.output += `${payload}\n`;
    };

    this.process.stdout.on('data', handleStdio);
    this.process.stderr.on('data', handleStdio);

    this.process.on('error', (error) => {
      if (this.ended) {
        return;
      }

      this.end(error);
    });

    this.process.on('exit', (code, signal) => {
      if (this.ended) {
        return;
      }

      if (code && code !== 0 || signal) {
        const error = FfmpegProcess.parseError(this.output, code || undefined, signal || undefined);
        this.end(error);
      } else {
        this.end();
      }
    });

    let timeoutId;

    try {
      const timeoutPromise = new Promise((resolve) => {
        timeoutId = setTimeout(resolve, 5 * 1000);
      })
        .then(async () => { throw new Error('Process timeout.'); });

      const spawnPromise = new Promise((resolve, reject) => {
        this.process!.stdout.once('data', resolve);
        this.process!.stderr.once('data', resolve);
        this.process!.once('error', reject);
      });

      await Bluebird.race([
        timeoutPromise,
        spawnPromise,
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async stop():Promise<any> {
    if (this.ended) {
      if (this.error) {
        throw this.error;
      }

      return;
    }

    let timeoutId;

    try {
      const timeoutTask = new Promise((resolve) => {
        timeoutId = setTimeout(resolve, config.ffmpeg.timeout * 1000);
      })
        .then(async () => { throw new Error('Process timeout.'); });

      const task = Bluebird.race([
        timeoutTask,
        new Promise(resolve => this.once('ended', resolve)),
      ]);

      this.process!.stdin.write('q');

      await task;
    } catch (error) {
      this.end(error);
    } finally {
      clearTimeout(timeoutId);
    }

    if (this.error) {
      throw this.error;
    }
  }

  private end(error?:Error|any) {
    if (this.ended) {
      return;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.process?.removeAllListeners();

    this.error = error;
    this.ended = true;

    this.emit('ended');
  }

  private static parseError(data:string, exitCode?:number, signal?:string):Error {
    if (signal) {
      return new Error(`Process killed with signal ${signal}`);
    }

    let startFound = false;

    const lines = data
      .split('\r\n')
      .map(x => x.trim())
      .filter(x => x !== '')
      .filter((x) => {
        if (startFound) return true;

        if (x === FFMPEG_START) {
          startFound = true;
          return false;
        }

        return false;
      })
      .map((x) => {
        return x.replace(/\[.+\] (.+)/g, '$1');
      });

    return new Error(
      lines.length > 0
        ? lines.join(' / ')
        : `FFMPEG failed: error code ${exitCode}.`,
    );
  }
}
