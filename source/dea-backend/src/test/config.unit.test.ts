/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { convictConfig, deaConfig, loadConfig } from '../config';

describe('convict based config', () => {
  it('loads configuration from the stage', () => {
    expect(deaConfig.region()).toBeDefined();
    expect(deaConfig.retainPolicy()).toEqual(RemovalPolicy.DESTROY);

    expect(deaConfig.userGroups()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'CaseWorkerGroup',
          description: 'containing users who need access to case APIs',
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
          description: "containing users who can't do anything in the system",
        }),
      ])
    );
  });

  it('throws an error for invalid group config', () => {
    expect(() => {
      loadConfig('invalid1');
    }).toThrow('userGroups: must be of type Array: value was "InvalidGroupConfig"');
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
});
