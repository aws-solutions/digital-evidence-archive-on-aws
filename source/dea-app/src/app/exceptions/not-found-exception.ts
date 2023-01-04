/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const NOT_FOUND_ERROR_NAME = 'NotFoundError';

// This will map to 404 in our ExceptionHandlers, 
// throw it anywhere with a message indicating the data that was expected to have the lambda wrapper handle the return for you
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = NOT_FOUND_ERROR_NAME;
  }
}
