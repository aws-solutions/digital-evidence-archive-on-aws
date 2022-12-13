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
            return 'info';
    }
}

export const logger = new LoggingService({
    maxLogLevel: logLevel(),
});