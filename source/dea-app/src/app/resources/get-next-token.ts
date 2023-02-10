/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const getNextToken = (nextToken: object | undefined): string | undefined => {
  if (nextToken) {
    return Buffer.from(JSON.stringify(nextToken)).toString('base64');
  }
  return undefined;
};
