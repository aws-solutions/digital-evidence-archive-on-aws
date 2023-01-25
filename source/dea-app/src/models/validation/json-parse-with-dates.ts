/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const jsonParseWithDates = <T>(payload: string): T => {
  return JSON.parse(payload, (key, value) => {
    if (['updated', 'created'].includes(key)) {
      return new Date(value);
    }
    return value;
  });
};
