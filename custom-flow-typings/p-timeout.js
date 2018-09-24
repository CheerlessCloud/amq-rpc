// @flow

declare module 'p-timeout' {
  declare class TimeoutError extends Error {
    constructor(string): void;
  }

  declare module.exports: <T>(Promise<T>, number, string | Error | (() => ?T)) => Promise<T>;
}
