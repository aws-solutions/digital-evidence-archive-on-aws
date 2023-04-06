/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import Joi from 'joi';
import { ValidationError } from './app/exceptions/validation-exception';
import { logger } from './logger';
import { Oauth2Token } from './models/auth';
import { Oauth2TokenSchema } from './models/validation/auth';
import { base64String, paginationLimit } from './models/validation/joi-common';

export interface PaginationParams {
  limit: number | undefined;
  nextToken: object | undefined;
}

export const getPaginationParameters = (event: APIGatewayProxyEvent): PaginationParams => {
  let limit: number | undefined;
  let next: string | undefined;
  let nextToken: object | undefined = undefined;
  if (event.queryStringParameters) {
    if (event.queryStringParameters['limit']) {
      limit = parseInt(event.queryStringParameters['limit']);
      Joi.assert(limit, paginationLimit);
    }
    if (event.queryStringParameters['next']) {
      next = event.queryStringParameters['next'];
      Joi.assert(next, base64String);
      nextToken = JSON.parse(Buffer.from(next, 'base64').toString('utf8'));
    }
  }
  return { limit, nextToken };
};

export const getQueryParam = (
  event: APIGatewayProxyEvent,
  paramName: string,
  defaultValue: string,
  validationSchema: Joi.StringSchema | Joi.NumberSchema
): string => {
  let paramValue = defaultValue;
  if (event.queryStringParameters) {
    paramValue = event.queryStringParameters[paramName] ?? defaultValue;
  }

  Joi.assert(paramValue, validationSchema);

  return paramValue;
};

export const getRequiredPathParam = (
  event: APIGatewayProxyEvent,
  paramName: string,
  validationSchema: Joi.StringSchema
): string => {
  if (event.pathParameters) {
    const value = event.pathParameters[paramName];
    if (value) {
      Joi.assert(value, validationSchema);
      return value;
    }
  }

  logger.error('Required path param missing', {
    rawPath: event.path,
    pathParams: JSON.stringify(event.pathParameters),
  });
  throw new ValidationError(`Required path param '${paramName}' is missing.`);
};

export function getRequiredPayload<T>(
  event: APIGatewayProxyEvent,
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

export const getRequiredHeader = (event: APIGatewayProxyEvent, headerName: string): string => {
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
    rawPath: event.path,
    headers: JSON.stringify(event.headers),
  });
  throw new ValidationError(`Required header '${headerName}' is missing.`);
};

export const getOauthToken = (event: APIGatewayProxyEvent): Oauth2Token => {
  if (event.headers['cookie'] && event.headers['cookie'].includes('idToken=')) {
    const token: Oauth2Token = JSON.parse(event.headers['cookie'].replace('idToken=', ''));
    Joi.assert(token, Oauth2TokenSchema);
    return token;
  }

  throw new ValidationError(`invalid oauth`);
};

export const getAllowedOrigin = (): string | undefined => {
  const value = process.env['ALLOWED_ORIGIN'];

  return value;
};

export const getUserUlid = (event: APIGatewayProxyEvent): string => {
  const maybeUserUlid = event.headers['userUlid'];
  if (maybeUserUlid) {
    return maybeUserUlid;
  }

  // runLambdaPreChecks should have added the userUlid, this is server error
  logger.error('User Ulid missing from event', {});
  throw new Error('userUlid was not present in the event header');
};

export const getTokenId = (event: APIGatewayProxyEvent): string => {
  const maybeTokenId = event.headers['tokenJti'];
  if (maybeTokenId) {
    return maybeTokenId;
  }

  // runLambdaPreChecks should have added the tokenJti, this is server error
  logger.error('Token Jti missing from event', {});
  throw new Error('Token Jti was not present in the event header');
};

export const getRequiredEnv = (envName: string, defaultValue?: string): string => {
  const value = process.env[envName] ?? defaultValue;
  if (!value) {
    throw new Error(`Required ENV ${envName} not set.`);
  }

  return value;
};
