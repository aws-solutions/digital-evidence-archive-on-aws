/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const VALIDATION_ERROR_NAME = 'DEAValidationError';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = VALIDATION_ERROR_NAME;
  }
}
