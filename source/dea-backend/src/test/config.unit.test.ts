/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { convictConfig, deaConfig, loadConfig } from '../config';

describe('convict based config', () => {
  it('loads configuration from the stage', () => {
    expect(deaConfig.region()).toBeDefined();
    expect(deaConfig.retainPolicy()).toEqual(RemovalPolicy.DESTROY);

    expect(deaConfig.deaRoleTypes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'CaseWorker',
          description: 'users who need access to case APIs',
        }),
        expect.objectContaining({
          name: 'AuthTestGroup',
          description: 'used for auth e2e testing',
        }),
        expect.objectContaining({
          name: 'CreateCasesTestGroup',
          description: 'used for create cases API e2e testing',
        }),
        expect.objectContaining({
          name: 'GetCaseTestGroup',
          description: 'used for get cases API e2e testing',
        }),
        expect.objectContaining({
          name: 'GetMyCasesTestGroup',
          description: 'used for get my cases API e2e testing',
        }),
        expect.objectContaining({
          name: 'NoPermissionsGroup',
          description: "users who can't do anything in the system",
        }),
      ])
    );
  });

  it('throws an error for invalid group config', () => {
    expect(() => {
      loadConfig('invalid1');
    }).toThrow('deaRoleTypes: must be of type Array: value was "InvalidGroupConfig"');
  });

  it('throws an error for invalid endpoint config', () => {
    expect(() => {
      loadConfig('invalid2');
    }).toThrow('endpoints: must be of type Array: value was "InvalidEndpoints"');
  });

  it('throws an error for invalid domain config', () => {
    expect(() => {
      // need the any here because convict doesn't resolve the type properly -.-
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badName: any = 'Domain_';
      convictConfig.set('cognito.domain', badName);
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('Cognito domain may only contain lowercase alphanumerics and hyphens.');
  });

  it('returns production policies when non-test', () => {
    convictConfig.set('testStack', false);
    expect(deaConfig.retainPolicy()).toEqual(RemovalPolicy.RETAIN);
    expect(deaConfig.retentionDays()).toEqual(RetentionDays.INFINITE);
  });

  it('allows kms actions in a test stack', () => {
    convictConfig.set('testStack', true);
    const actions = deaConfig.kmsAccountActions();
    const wildcard = actions.find((action) => action === 'kms:*');
    expect(wildcard).toBeDefined();
  });

  it('disallows kms actions in a prod stack', () => {
    convictConfig.set('testStack', false);
    const actions = deaConfig.kmsAccountActions();
    const wildcard = actions.find((action) => action === 'kms:*');
    const decryptAction = actions.find((action) => action === 'kms:Decrypt*');
    expect(wildcard).toBeUndefined();
    expect(decryptAction).toBeUndefined();
  });

  it('returns default allowed origin configuration', () => {
    convictConfig.set('deaAllowedOrigins', '');
    expect(deaConfig.deaAllowedOrigins()).toEqual('');
    expect(deaConfig.deaAllowedOriginsList()).toEqual([]);
  });

  it('returns samesite values for test and prod', () => {
    convictConfig.set('testStack', true);
    expect(deaConfig.sameSiteValue()).toEqual('None');
    convictConfig.set('testStack', false);
    expect(deaConfig.sameSiteValue()).toEqual('Strict');
  });

  it('returns allowed origin configuration', () => {
    convictConfig.set('deaAllowedOrigins', 'https://localhost,https://test');
    expect(deaConfig.deaAllowedOrigins()).toEqual('https://localhost,https://test');
    expect(deaConfig.deaAllowedOriginsList()).toEqual(['https://localhost', 'https://test']);
  });

  it('returns preflight options for production', () => {
    convictConfig.set('testStack', false);
    expect(deaConfig.preflightOptions()).toBeUndefined();
  });

  it('returns preflight options for test stack', () => {
    convictConfig.set('testStack', true);
    const preflightOpt = deaConfig.preflightOptions();
    if (!preflightOpt) {
      fail();
    }
    expect(Object.keys(preflightOpt).length).toBeGreaterThan(0);
  });
});
