/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { convictConfig, deaConfig, loadConfig } from '../config';

describe('convict based config', () => {
  it('loads configuration from the stage', () => {
    expect(deaConfig.region()).toBeDefined();
    expect(deaConfig.retainPolicy()).toEqual(RemovalPolicy.DESTROY);

    expect(deaConfig.userGroups()).toEqual(
      expect.arrayContaining([
        {
          name: 'CaseWorkerGroup',
          description: 'containing users who need access to case APIs',
          precedence: 1,
          endpoints: expect.arrayContaining([
            { path: '/cases', method: 'GET' },
            { path: '/cases', method: 'POST' },
            { path: '/cases/{caseId}', method: 'GET' },
            { path: '/cases/{caseId}', method: 'PUT' },
            { path: '/cases/{caseId}', method: 'DELETE' },
            { path: '/cases/{caseId}/userMemberships', method: 'POST' },
            { path: '/cases/{caseId}/files', method: 'POST' },
            { path: '/cases/{caseId}/files', method: 'GET' },
            { path: '/cases/{caseId}/files/{fileId}', method: 'GET' },
            { path: '/cases/{caseId}/files/{fileId}', method: 'PUT' },
          ]),
        },
        {
          name: 'AuthTestGroup',
          description: 'used for auth e2e testing',
          precedence: 100,
          endpoints: expect.arrayContaining([
            { path: '/hi', method: 'GET' },
            { path: '/bye', method: 'GET' },
          ]),
        },
        {
          name: 'CreateCasesTestGroup',
          description: 'used for create cases API e2e testing',
          precedence: 100,
          endpoints: expect.arrayContaining([
            { path: '/cases', method: 'POST' },
            { path: '/cases/{caseId}', method: 'DELETE' },
            { path: '/cases/all-cases', method: 'GET' },
          ]),
        },
        {
          name: 'GetCaseTestGroup',
          description: 'used for get cases API e2e testing',
          precedence: 100,
          endpoints: expect.arrayContaining([
            { path: '/cases', method: 'POST' },
            { path: '/cases/{caseId}', method: 'DELETE' },
            { path: '/cases/{caseId}', method: 'GET' },
          ]),
        },
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

  it('returns a destroy policy when non-test', () => {
    convictConfig.set('testStack', false);
    expect(deaConfig.retainPolicy()).toEqual(RemovalPolicy.RETAIN);
  });
});
