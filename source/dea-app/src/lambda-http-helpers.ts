/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ValidationError } from './app/exceptions/validation-exception';
import { logger } from './logger';

export const getRequiredPathParam = (event: APIGatewayProxyEventV2, paramName: string): string => {
  if (event.pathParameters) {
    const value = event.pathParameters[paramName];
    if (value) {
      return value;
    }
  }

  logger.error('Required path param missing', {
    rawPath: event.rawPath,
    pathParams: JSON.stringify(event.pathParameters),
  });
  throw new ValidationError(`Required path param '${paramName}' is missing.`);
};

export const getUserUlid = (event: APIGatewayProxyEventV2): string => {
  const maybeUserUlid = event.headers['userUlid'];
  if (maybeUserUlid) {
    return maybeUserUlid;
  }

  // runLambdaPreChecks should have added the userUlid, this is server error
  logger.error('User Ulid missing from event');
  throw new Error('userUlid was not present in the event header');
};

export const getRequiredEnv = (envName: string, defaultValue?: string): string => {
  const value = process.env[envName] ?? defaultValue;
  if (!value) {
    throw new Error(`Required ENV ${envName} not set.`);
  }

  return value;
};
