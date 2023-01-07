/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { LoggingService, LogLevel } from '@aws/workbench-core-logging';

const logLevel = (): LogLevel => {
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
}

export const logger = new LoggingService({
    maxLogLevel: logLevel(),
});