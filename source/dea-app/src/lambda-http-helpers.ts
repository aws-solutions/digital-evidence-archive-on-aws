/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import Joi from 'joi';
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

export function getRequiredPayload<T>(
  event: APIGatewayProxyEventV2,
  typeName: string,
  validationSchema: Joi.ObjectSchema
): T {
  if (!event.body) {
    throw new ValidationError(`${typeName} payload missing.`);
  }
  const payload: T = JSON.parse(event.body);
  Joi.assert(payload, validationSchema);

  return payload;
}

export const getRequiredHeader = (event: APIGatewayProxyEventV2, headerName: string): string => {
  let value = event.headers[headerName];
  if (value) {
    return value;
  }

  // https://www.ietf.org/rfc/rfc2616.txt
  // 4.2 Message Headers
  // ... Field names are case-insensitive ...
  // Api gateway doesnt send these headers lower-cased as it should, but some clients will
  value = event.headers[headerName.toLowerCase()];

  if (value) {
    return value;
  }

  logger.error(`Required header missing: ${headerName}`, {
    rawPath: event.rawPath,
    headers: JSON.stringify(event.headers),
  });
  throw new ValidationError(`Required header '${headerName}' is missing.`);
};

export const getUserUlid = (event: APIGatewayProxyEventV2): string => {
  const maybeUserUlid = event.headers['userUlid'];
  if (maybeUserUlid) {
    return maybeUserUlid;
  }

  // runLambdaPreChecks should have added the userUlid, this is server error
  logger.error('User Ulid missing from event', {});
  throw new Error('userUlid was not present in the event header');
};

export const getRequiredEnv = (envName: string, defaultValue?: string): string => {
  const value = process.env[envName] ?? defaultValue;
  if (!value) {
    throw new Error(`Required ENV ${envName} not set.`);
  }

  return value;
};
