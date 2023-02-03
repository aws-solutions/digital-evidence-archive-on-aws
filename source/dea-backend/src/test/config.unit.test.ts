/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { deaConfig, loadConfig } from '../config';

describe('convict based config', () => {
  it('loads configuration', () => {
    expect(deaConfig.stage()).toEqual('test');
    expect(deaConfig.cognitoDomain()).toBeUndefined();
    expect(deaConfig.region()).toBeDefined();

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
      console.log(deaConfig.userGroups());
    }).toThrow('endpoints: must be of type Array: value was "InvalidEndpoints"');
  });
});
