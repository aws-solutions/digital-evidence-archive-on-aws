/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export declare type LogLevel = 'silly' | 'debug' | 'verbose' | 'http' | 'info' | 'warn' | 'error';

export const logLevel = (): LogLevel => {
  const level = process.env.LOG_LEVEL;
  switch (level) {
    case 'silly':
    case 'debug':
    case 'verbose':
    case 'http':
    case 'info':
    case 'warn':
    case 'error':
      return level;
    default:
      return 'debug';
  }
};

export const logger = {
  debug: (msg: string, obj?: object) => {
    console.debug(`${msg}`, obj);
  },
  error: (msg: string, obj?: object) => {
    console.error(`${msg}`, obj);
  },
  info: (msg: string, obj?: object) => {
    console.info(`${msg}`, obj);
  },
  warn: (msg: string, obj?: object) => {
    console.warn(`${msg}`, obj);
  },
};
// Removing the logger until we figure out performance
// export const logger = new LoggingService({
//   maxLogLevel: logLevel(),
// });
