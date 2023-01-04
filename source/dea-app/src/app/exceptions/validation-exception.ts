/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const VALIDATION_ERROR_NAME = 'DEAValidationError';

// This will map to 400 in our ExceptionHandlers, 
// throw it anywhere with a message indicating the failed validation to have the lambda wrapper handle the return for you
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = VALIDATION_ERROR_NAME;
  }
}
