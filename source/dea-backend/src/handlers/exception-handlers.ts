/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FORBIDDEN_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/forbidden-exception';
import { NOT_FOUND_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/not-found-exception';
import { REAUTHENTICATION_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/reauthentication-exception';
import { THROTTLING_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/throttling-exception';
import { VALIDATION_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/validation-exception';
import { withAllowedOrigin } from '@aws/dea-app/lib/app/resources/dea-lambda-utils';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { logger } from '../logger';

const AWS_CLIENT_INVALID_PARAMETER_NAME = 'InvalidParameterException';
const AWS_THROTTLING_ERROR_NAME = 'ThrottlingException';
// Exception name thrown from CloudWatch when the quota limit is exceeded.
const AWS_LIMITED_EXCEEDED_ERROR_NAME = 'LimitExceededException';
// DynamoDB https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html
// Exception thrown during concurrent item-level requests(i.e Throttling from DynamoDB)
const AWS_DYNAMODB_TRANSACTION_CANCELED_ERROR_NAME = 'TransactionCanceledException';
const AWS_DATASYNC_INVALID_REQUEST_ERROR_NAME = 'InvalidRequestException';
const AWS_ATHENA_TOO_MANY_REQUEST_ERROR_NAME = 'TooManyRequestsException';

// If you have a new error case that you want to support, create a new Class that extends Error
// and add a handler here that responds with an appropriate status code.

export type ExceptionHandler = (error: Error, event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

const notFoundHandler: ExceptionHandler = async (error, event) => {
  logger.error('NotFoundError', error);
  return withAllowedOrigin(event, {
    statusCode: 404,
    body: error.message,
  });
};

const validationErrorHandler: ExceptionHandler = async (error, event) => {
  logger.error('ValidationError', error);
  return withAllowedOrigin(event, {
    statusCode: 400,
    body: error.message,
  });
};

const joiValidationErrorHandler: ExceptionHandler = async (error, event) => {
  if (error instanceof Joi.ValidationError) {
    return withAllowedOrigin(event, {
      statusCode: 400,
      body: error.details.map((err) => err.message).join(','),
    });
  }
  return validationErrorHandler(error, event);
};

const forbiddenErrorHandler: ExceptionHandler = async (error, event) => {
  logger.error('Forbidden', { message: error.message });
  return withAllowedOrigin(event, {
    statusCode: 403,
    body: 'Forbidden',
  });
};

const reauthenticationErrorHandler: ExceptionHandler = async (error, event) => {
  logger.error('Reauthenticate', { message: error.message });
  return withAllowedOrigin(event, {
    statusCode: 412,
    body: 'Reauthenticate',
  });
};

const defaultErrorHandler: ExceptionHandler = async (error, event) => {
  return withAllowedOrigin(event, {
    statusCode: 500,
    body: 'An error occurred',
  });
};

const throttlingErrorHandler: ExceptionHandler = async (error, event) => {
  logger.error('ThrottlingError', error);
  return withAllowedOrigin(event, {
    statusCode: 429,
    body: 'Too Many Requests',
  });
};

const badRequestErrorHandler: ExceptionHandler = async (error, event) => {
  logger.error('BadRequestError', error);
  return withAllowedOrigin(event, {
    statusCode: 400,
    body: 'Bad Request',
  });
};

const joiInstance = new Joi.ValidationError('', [], undefined);
const errorInstance = new Error('');

export const exceptionHandlers = new Map<string, ExceptionHandler>();
exceptionHandlers.set(errorInstance.name, defaultErrorHandler);
exceptionHandlers.set(VALIDATION_ERROR_NAME, validationErrorHandler);
exceptionHandlers.set(NOT_FOUND_ERROR_NAME, notFoundHandler);
exceptionHandlers.set(joiInstance.name, joiValidationErrorHandler);
exceptionHandlers.set(FORBIDDEN_ERROR_NAME, forbiddenErrorHandler);
exceptionHandlers.set(AWS_CLIENT_INVALID_PARAMETER_NAME, validationErrorHandler);
exceptionHandlers.set(REAUTHENTICATION_ERROR_NAME, reauthenticationErrorHandler);
exceptionHandlers.set(AWS_THROTTLING_ERROR_NAME, throttlingErrorHandler);
exceptionHandlers.set(THROTTLING_ERROR_NAME, throttlingErrorHandler);
exceptionHandlers.set(AWS_LIMITED_EXCEEDED_ERROR_NAME, throttlingErrorHandler);
exceptionHandlers.set(AWS_DYNAMODB_TRANSACTION_CANCELED_ERROR_NAME, throttlingErrorHandler);
exceptionHandlers.set(AWS_DATASYNC_INVALID_REQUEST_ERROR_NAME, badRequestErrorHandler);
exceptionHandlers.set(AWS_ATHENA_TOO_MANY_REQUEST_ERROR_NAME, throttlingErrorHandler);
