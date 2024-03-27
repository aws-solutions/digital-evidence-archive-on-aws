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
    const oldCognitoDomain = convictConfig.get('cognito.domain');
    expect(() => {
      // need the any here because convict doesn't resolve the type properly -.-
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badName: any = 'Domain_';
      convictConfig.set('cognito.domain', badName);
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('Cognito domain may only contain lowercase alphanumerics and hyphens.');
    convictConfig.set('cognito.domain', oldCognitoDomain);
  });

  it('returns production policies when non-test', () => {
    convictConfig.set('testStack', false);
    expect(deaConfig.retainPolicy()).toEqual(RemovalPolicy.RETAIN);
    expect(deaConfig.retentionDays()).toEqual(RetentionDays.INFINITE);
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

  it('returns preflight options when allowedOrigins is set', () => {
    convictConfig.set('deaAllowedOrigins', 'https://localhost,https://test');
    const preflightOpt = deaConfig.preflightOptions();
    if (!preflightOpt) {
      fail();
    }
    expect(Object.keys(preflightOpt).length).toBeGreaterThan(0);
  });

  it('returns no preflight options when not allowedOrigins is set', () => {
    convictConfig.set('deaAllowedOrigins', '');
    expect(deaConfig.preflightOptions()).toBeUndefined();
  });

  it('errors if the stage name is too long', () => {
    const oldStage = convictConfig.get('stage');
    convictConfig.set('stage', 'abcdefghijklmnopqrstuvwxyz');
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Stage name must not exceed 21 characters');
    convictConfig.set('stage', oldStage);
  });

  it('errors if the stage is not string', () => {
    const oldStage = convictConfig.get('stage');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore. just let me break it bro
    convictConfig.set('stage', 3);
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Stage value must be a string');
    convictConfig.set('stage', oldStage);
  });

  it('errors if the stage has invalid characters', () => {
    const oldStage = convictConfig.get('stage');
    convictConfig.set('stage', 'invalidst@ge');
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Stage name may only contain alphanumerics and hyphens.');
    convictConfig.set('stage', oldStage);
  });

  it('confirms cidr format above 0', () => {
    const oldSourceIpCidr = convictConfig.get('sourceIpSubnetMaskCIDR');
    convictConfig.set('sourceIpSubnetMaskCIDR', -1);
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('Source IP CIDR must be between 0 and 32');
    convictConfig.set('sourceIpSubnetMaskCIDR', oldSourceIpCidr);
  });

  it('confirms cidr format less than 32', () => {
    const oldSourceIpCidr = convictConfig.get('sourceIpSubnetMaskCIDR');
    convictConfig.set('sourceIpSubnetMaskCIDR', 55);
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('Source IP CIDR must be between 0 and 32');
    convictConfig.set('sourceIpSubnetMaskCIDR', oldSourceIpCidr);
  });

  it('confirms cidr is a number', () => {
    const oldSourceIpCidr = convictConfig.get('sourceIpSubnetMaskCIDR');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore. just let me break it bro
    convictConfig.set('sourceIpSubnetMaskCIDR', 'notanumber');
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('Source IP CIDR must be of type number');
    convictConfig.set('sourceIpSubnetMaskCIDR', oldSourceIpCidr);
  });

  // it('confirms groupToDeaRoleRules is an array', () => {
  //   convictConfig.set('groupToDeaRoleRules', 'notanumber');
  //   expect(() => {
  //     convictConfig.validate({ allowed: 'strict' });
  //   }).toThrow('groupToDeaRoleRules must be of type Array');
  // });

  // it('confirms groupToDeaRoleRules has a length under 25', () => {
  //   const someArray: string[] = [];
  //   someArray.length = 23;
  //   convictConfig.set('groupToDeaRoleRules', someArray);
  //   expect(() => {
  //     convictConfig.validate({ allowed: 'strict' });
  //   }).toThrow('something');
  // });

  it('confirms upload timeout is a number', () => {
    const oldUploadTimeout = convictConfig.get('uploadFilesTimeoutMinutes');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore. just let me break it bro
    convictConfig.set('uploadFilesTimeoutMinutes', 'notanumber');
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Upload Timeout value must be a number');
    convictConfig.set('uploadFilesTimeoutMinutes', oldUploadTimeout);
  });

  it('confirms upload timeout is greater than zero', () => {
    const oldUploadTimeout = convictConfig.get('uploadFilesTimeoutMinutes');
    convictConfig.set('uploadFilesTimeoutMinutes', -1);
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Upload Timeout value must be a positive number');
    convictConfig.set('uploadFilesTimeoutMinutes', oldUploadTimeout);
  });

  it('confirms upload timeout is less than 60', () => {
    const oldUploadTimeout = convictConfig.get('uploadFilesTimeoutMinutes');
    convictConfig.set('uploadFilesTimeoutMinutes', 61);
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Upload Timeout value must be less than 60 minutes');
    convictConfig.set('uploadFilesTimeoutMinutes', oldUploadTimeout);
  });

  it('confirms lambdaCacheTtl is a number', () => {
    const oldLambdaTtl = convictConfig.get('lambdaCacheTtl');
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore. just let me break it bro
    convictConfig.set('lambdaCacheTtl', 'notanumber');
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Lambda Cache TTL value must be a number');
    convictConfig.set('lambdaCacheTtl', oldLambdaTtl);
  });

  it('confirms lambdaCacheTtl is greater than zero', () => {
    const oldLambdaTtl = convictConfig.get('lambdaCacheTtl');
    convictConfig.set('lambdaCacheTtl', -1);
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Lambda Cache TTL value must be a positive number');
    convictConfig.set('lambdaCacheTtl', oldLambdaTtl);
  });

  it('confirms lambdaCacheTtl is less than 300000', () => {
    const oldLambdaTtl = convictConfig.get('lambdaCacheTtl');
    convictConfig.set('lambdaCacheTtl', 300001);
    expect(() => {
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Lambda Cache TTL value must be less than 300000 ms (300 seconds, 5 minutes)');
    convictConfig.set('lambdaCacheTtl', oldLambdaTtl);
  });
});
