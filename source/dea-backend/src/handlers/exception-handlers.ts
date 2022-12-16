/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { NOT_FOUND_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/not-found-exception';
import { VALIDATION_ERROR_NAME } from '@aws/dea-app/lib/app/exceptions/validation-exception';
import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import Joi from 'joi';

export type ExceptionHandler = (error: Error) => Promise<APIGatewayProxyStructuredResultV2>;

const notFoundHandler: ExceptionHandler = async (error) => {
  return {
    statusCode: 404,
    body: error.message,
  };
};

const validationErrorHandler: ExceptionHandler = async (error) => {
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
