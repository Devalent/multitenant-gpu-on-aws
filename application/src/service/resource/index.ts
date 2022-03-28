import logger from '../logger';

class Timeout {
  private timeoutId?:NodeJS.Timeout;

  constructor(
    private readonly timeout:number,
    private readonly name:string,
  ) {}

  public run():Promise<void> {
    if (this.timeoutId) {
      throw new Error('Already started.');
    }

    return new Promise((resolve) => {
      this.timeoutId = setTimeout(resolve, this.timeout);
    })
      .then(() => Promise.reject(new Error(`Timeout "${this.name}" reached.`)));
  }

  public dispose():void {
    if (!this.timeoutId) {
      throw new Error('Not started.');
    }

    clearTimeout(this.timeoutId);
    this.timeoutId = undefined;
  }
}

class ResourceProvider {
  async requestShudown():Promise<void> {
    logger.info({}, 'Shutdown requested.');

    process.exit(1);
  }

  public createTimeout(timeout:number, name:string):Timeout {
    return new Timeout(timeout, name);
  }
}

export default new ResourceProvider();
