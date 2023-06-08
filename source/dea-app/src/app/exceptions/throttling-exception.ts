/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const THROTTLING_ERROR_NAME = 'ThrottlingException';

// This will map to 429 in our ExceptionHandlers,
export class ThrottlingException extends Error {
  constructor(message: string) {
    super(message);
    this.name = THROTTLING_ERROR_NAME;
  }
}
