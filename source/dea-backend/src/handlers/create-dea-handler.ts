/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DEAGatewayProxyHandler, runPreExecutionChecks } from '@aws/dea-app';
import { logger } from '../logger';
import { exceptionHandlers } from './exception-handlers';

// This will wrap our handlers in any top level, prerequisite type code that we want to run prior to our lambdas.
// This adds a try/catch for the wrapped lambda
// - you should only be writing your own try/catch if you are planning to handle errors locally for some reason (e.g. retries).
export const createDeaHandler = (
  handler: DEAGatewayProxyHandler,
  /* the default case is handled in e2e and integration tests */
  /* istanbul ignore next */
  preExecutionChecks = runPreExecutionChecks
): DEAGatewayProxyHandler => {
  const wrappedHandler: DEAGatewayProxyHandler = async (event, context) => {
    try {
      // Before we run the handler, run the pre-execution checks
      // which include adding first time federated users to the db
      // so they can be invited to cases later, and session management
      // checks, like session lock and no concurrent active sessions
      await preExecutionChecks(event, context);
      return await handler(event, context);
    } catch (error) {
      logger.error('Error', { Body: JSON.stringify(error) });
      if (typeof error === 'object') {
        if ('name' in error) {
          const errorHandler = exceptionHandlers.get(error.name);
          if (errorHandler) {
            return errorHandler(error);
          }
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
