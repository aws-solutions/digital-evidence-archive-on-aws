/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { configFileExists, generateQuestions } from '../deployment-helpers/manage-config';

describe('deployment helpers for config', () => {
  describe('configFileExists', () => {
    it('returns false when file does NOT exist', () => {
      expect(configFileExists('doesnotexistfile')).toBeFalsy();
    });

    it('returns true when file does exist', () => {
      expect(configFileExists('devsample')).toBeTruthy();
    });
  });

  describe('generateQuestions', () => {
    // This test will fail when there is a schema field it does not recognize
    // which ensure we are handling every new schema field for generate/update config
    // If this unit test fails, add your new schema field
    // to the generateQuestions switch statement in manage-config.ts
    it('has a question for each schema field', async () => {
      generateQuestions('fakeconfig');
    });
  });
});
