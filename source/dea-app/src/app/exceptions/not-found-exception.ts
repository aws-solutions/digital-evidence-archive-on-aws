/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const NOT_FOUND_ERROR_NAME = 'NotFoundError';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = NOT_FOUND_ERROR_NAME;
  }
}
