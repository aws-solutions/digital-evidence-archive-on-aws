/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getQueryParam, getRequiredEnv, getRequiredHeader, getTokenId } from '../lambda-http-helpers';
import { getDummyEvent } from './integration-objects';

describe('lambda http helper edge cases', () => {
  describe('getRequiredEnv', () => {
    it('throws if the env is not found and no default is provided', () => {
      expect(() => {
        getRequiredEnv('bogusval');
      }).toThrow('Required ENV bogusval not set.');
    });
  });

  describe('getQueryParam', () => {
    it('Returns default if necessary', () => {
      const event = getDummyEvent({
        queryStringParameters: {
          world: 'hello',
        },
      });
      const defaultValue = 'world';
      expect(getQueryParam(event, 'hello', defaultValue, Joi.string())).toEqual(defaultValue);
      expect(getQueryParam(event, 'world', defaultValue, Joi.string())).toEqual('hello');
    });
  });

  describe('getTokenId', () => {
    it('Throws exception when jti missing from event', () => {
      const event = getDummyEvent();
      expect(() => getTokenId(event)).toThrow('TokenId was not present in the event header');
    });
  });

  describe('getRequiredHeader', () => {
    it('considers lower case values', () => {
      const event = getDummyEvent({
        headers: {
          alowercasevalue: 'somevalue',
        },
      });
      const foundVal = getRequiredHeader(event, 'ALOWERCASEVALUE');

      expect(foundVal).toEqual('somevalue');
    });

    it('throws when a value is not found', () => {
      const event = getDummyEvent({
        headers: {},
      });
      expect(() => getRequiredHeader(event, 'idToken')).toThrow(`Required header 'idToken' is missing.`);
    });
  });
});
