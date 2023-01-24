/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DEALambda, DEAGatewayProxyHandler } from '@aws/dea-app';
import { logger } from '../logger';
import { exceptionHandlers } from './exception-handlers';

// This will wrap our handlers in any top level, prerequisite type code that we want to run prior to our lambdas.
// This adds a try/catch for the wrapped lambda
// - you should only be writing your own try/catch if you are planning to handle errors locally for some reason (e.g. retries).
export const createDeaHandler = (handler: DEALambda): DEAGatewayProxyHandler => {
  const wrappedHandler: DEAGatewayProxyHandler = async (event, context) => {
    try {
      return await handler.handle(event, context);
    } catch (error) {
      logger.error('Error', { Body: JSON.stringify(error) });
      if ('name' in error) {
        const errorHandler = exceptionHandlers.get(error.name);
        if (errorHandler) {
          return errorHandler(error);
        }
      }

      return Promise.resolve({
        statusCode: 500,
        body: 'Server Error',
      });
    }
  };
  return wrappedHandler;
};
