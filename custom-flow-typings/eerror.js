// @flow

declare module 'eerror' {
  declare class EError extends Error {
    constructor(?string): void;
    combine(Object): EError;
    wrap(Error, Object): EError;
    static wrap(Error, Object): EError;
    static prepare(Class<EError> | Object, ?Object): Class<EError>;
    [string]: any;
  }

  declare module.exports: Class<EError>;
}
