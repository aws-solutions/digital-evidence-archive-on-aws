/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const FORBIDDEN_ERROR_NAME = 'Forbidden';

// This will map to 403 in our ExceptionHandlers,
// throw it anywhere with a message indicating the data that was expected to have the lambda wrapper handle the return for you
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = FORBIDDEN_ERROR_NAME;
  }
}
