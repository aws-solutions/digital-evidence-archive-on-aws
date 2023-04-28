/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const REAUTHENTICATION_ERROR_NAME = 'Reauthentication';

// This will map to 412 in our ExceptionHandlers,
// Used for CJIS Session Management Requirement Failures
// E.g. no Concurrent User Sessions and Session Lock after 30 minutes of inactivity
// throw it anywhere with a message indicating the data that was expected to have the lambda wrapper handle the return for you
export class ReauthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = REAUTHENTICATION_ERROR_NAME;
  }
}
