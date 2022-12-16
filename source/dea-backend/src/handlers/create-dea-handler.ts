/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DEAGatewayProxyHandler } from '@aws/dea-app';
import { exceptionHandlers } from './exception-handlers';

export const createDeaHandler = (handler: DEAGatewayProxyHandler): DEAGatewayProxyHandler => {
  const wrappedHandler: DEAGatewayProxyHandler = async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      if (error instanceof Error) {
        const errorHandler = exceptionHandlers.get(error.name);
        if (errorHandler) {
          return errorHandler(error);
        }
      }

      return Promise.resolve({
        statusCode: 500,
        body: 'Error',
      });
    }
  };
  return wrappedHandler;
};
