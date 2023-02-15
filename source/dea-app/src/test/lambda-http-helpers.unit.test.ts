/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredEnv, getRequiredHeader } from '../lambda-http-helpers';
import { dummyEvent } from './integration-objects';

describe('lambda http helper edge cases', () => {
  describe('getRequiredEnv', () => {
    it('throws if the env is not found and no default is provided', () => {
      expect(() => {
        getRequiredEnv('bogusval');
      }).toThrow('Required ENV bogusval not set.');
    });
  });

  describe('getRequiredHeader', () => {
    it('considers lower case values', () => {
      const event = Object.assign(
        {},
        {
          ...dummyEvent,
          headers: {
            alowercasevalue: 'somevalue',
          },
        }
      );
      const foundVal = getRequiredHeader(event, 'ALOWERCASEVALUE');

      expect(foundVal).toEqual('somevalue');
    });

    it('throws when a value is not found', () => {
      const event = Object.assign(
        {},
        {
          ...dummyEvent,
          headers: {},
        }
      );
      expect(() => getRequiredHeader(event, 'idToken')).toThrow(`Required header 'idToken' is missing.`);
    });
  });
});
