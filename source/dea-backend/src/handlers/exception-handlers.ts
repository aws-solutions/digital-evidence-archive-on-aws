/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FORBIDDEN_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/forbidden-exception';
import { NOT_FOUND_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/not-found-exception';
import { REAUTHENTICATION_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/reauthentication-exception';
import { VALIDATION_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/validation-exception';
import { APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { logger } from '../logger';

const AWS_CLIENT_INVALID_PARAMETER_NAME = 'InvalidParameterException';
// If you have a new error case that you want to support, create a new Class that extends Error
// and add a handler here that responds with an appropriate status code.

export type ExceptionHandler = (error: Error) => Promise<APIGatewayProxyResult>;

const notFoundHandler: ExceptionHandler = async (error) => {
  logger.error('NotFoundError', error);
  return {
    statusCode: 404,
    body: error.message,
  };
};

const validationErrorHandler: ExceptionHandler = async (error) => {
  logger.error('ValidationError', error);
  return {
    statusCode: 400,
    body: error.message,
  };
};

const joiValidationErrorHandler: ExceptionHandler = async (error) => {
  if (error instanceof Joi.ValidationError) {
    return {
      statusCode: 400,
      body: error.details.map((err) => err.message).join(','),
    };
  }
  return validationErrorHandler(error);
};

const forbiddenErrorHandler: ExceptionHandler = async (error) => {
  logger.error('Forbidden', { message: error.message });
  return {
    statusCode: 403,
    body: 'Forbidden',
  };
};

const reauthenticationErrorHandler: ExceptionHandler = async (error) => {
  logger.error('Reauthenticate', { message: error.message });
  return {
    statusCode: 412,
    body: 'Reauthenticate',
  };
};

const defaultErrorHandler: ExceptionHandler = async () => {
  return {
    statusCode: 500,
    body: 'An error occurred',
  };
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
