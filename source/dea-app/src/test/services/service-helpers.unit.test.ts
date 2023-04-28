/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { retry } from '../../app/services/service-helpers';

describe('service helpers', () => {
  it('retry will throw error if it runs out of retries', async () => {
    const failFunction = () => {
      throw new Error('should not succeed');
    };
    await expect(retry(failFunction, /*retries=*/ 3, /*interval=*/ 1)).rejects.toThrow('should not succeed');
  });

  it('retry will retry successfully', async () => {
    let attempt = 1;
    const failFirst2TimesThenSucceed = async () => {
      if (attempt < 3) {
        attempt = attempt + 1;
        throw new Error('Fail');
      } else {
        return 3;
      }
    };

    const result = await retry(failFirst2TimesThenSucceed, /*retries=*/ 3, /*interval=*/ 1);
    expect(result).toBe(3);
  });
});
