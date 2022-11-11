/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getConstants } from '../constants';

describe('constants', () => {
  describe('valid config', () => {
    beforeAll(() => {
      process.env.STAGE = 'test';
    });

    afterAll(() => {
      delete process.env.STAGE;
    });

    it('should give us constant values', () => {
      const theConstants = getConstants();

      expect(theConstants).toBeTruthy();

      //spot check
      expect(theConstants.CLIENT_SECRET).toEqual('shh');
      expect(theConstants.AWS_REGION_SHORT_NAME).toEqual('Testville');
      expect(theConstants.ALLOWED_ORIGINS).toEqual(JSON.stringify(['test', 'https://bogus.bogus']));
    });
  });

  describe('missing config', () => {
    beforeAll(() => {
      process.env.STAGE = 'bogus';
    });

    afterAll(() => {
      delete process.env.STAGE;
    });

    it('should throw an exception', () => {
      expect(() => getConstants()).toThrowError();
    });
  });
});
