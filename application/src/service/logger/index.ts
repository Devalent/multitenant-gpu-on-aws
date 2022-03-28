import pino from 'pino';

export default pino({
  level: 'debug',
  mixin(context:any) {
    const mixin:any = {};

    if (context?.error?.message) {
      mixin.error = context?.error?.message;
    }

    return mixin;
  },
  mixinMergeStrategy(mergeObject, mixinObject) {
    return Object.assign(mergeObject, mixinObject);
  },
});
