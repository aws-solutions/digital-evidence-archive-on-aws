/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import convict from 'convict';
import { convictConfig, convictSchema, deaConfig, loadConfig } from '../config';

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

  it('throws an error for invalid region', () => {
    const oldRegion = convictConfig.get('region');

    expect(() => {
      // need the any here because convict doesn't resolve the type properly -.-
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badRegion: any = 'us-blah-1';
      convictConfig.set('region', badRegion);
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('region: must be one of the possible values:');

    convictConfig.set('region', oldRegion);
  });

  it('throws an error for invalid domain config', () => {
    const oldCognitoDomain = convictConfig.get('cognito.domain');

    // Must be a string
    expect(() => {
      // need the any here because convict doesn't resolve the type properly -.-
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badName: any = 1;
      convictConfig.set('cognito.domain', badName);
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('The Cognito domain value must be a string.');

    // Check the regex
    expect(() => {
      // need the any here because convict doesn't resolve the type properly -.-
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badName: any = 'Domain_';
      convictConfig.set('cognito.domain', badName);
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('Cognito domain may only contain lowercase alphanumerics and hyphens.');

    // Test it does not allow the banned words: aws cognito and amazon
    expect(() => {
      // need the any here because convict doesn't resolve the type properly -.-
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badName: any = 'awsdomain';
      convictConfig.set('cognito.domain', badName);
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('You cannot use aws, amazon, or cognito in the cognito domain prefix.');
    expect(() => {
      // need the any here because convict doesn't resolve the type properly -.-
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badName: any = 'cognitodomain';
      convictConfig.set('cognito.domain', badName);
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('You cannot use aws, amazon, or cognito in the cognito domain prefix.');
    expect(() => {
      // need the any here because convict doesn't resolve the type properly -.-
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badName: any = 'amazondomain';
      convictConfig.set('cognito.domain', badName);
      convictConfig.validate({ allowed: 'strict' });
    }).toThrow('You cannot use aws, amazon, or cognito in the cognito domain prefix.');

    convictConfig.set('cognito.domain', oldCognitoDomain);
  });

  it('throws for invalid custom domain configs', () => {
    const config = convict(convictSchema);
    // need the any here because convict doesn't resolve the type properly -.-
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodDomainName: any = 'idcentergamma.digitalevidencearchive.com';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badDomainName: any = 'idcentergamma.Digitalevidencearchive.com';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodAcmArn: any =
      'arn:aws:acm:us-east-2:012345678910:certificate/864569eb-8eed-4fc7-891a-d54fedb8808b';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badAcmArn: any = 'arn:aws:acm:us-east-2:012345678910';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodHostedZoneId: any = 'Z09256561H1NBMQR5VVM7';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badHostedZoneId: any = '09256561H1NBMQR5VVM7JJJJJ';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodHostedZoneName: any = 'digitalevidencearchive.com';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badHostedZoneName: any = 'DEA.com';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function expectFailure(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      domainName: any | undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      acmArn: any | undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hostedZoneId: any | undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hostedZoneName: any | undefined,
      error: string
    ) {
      config.set('customDomain.domainName', domainName);
      config.set('customDomain.certificateArn', acmArn);
      config.set('customDomain.hostedZoneId', hostedZoneId);
      config.set('customDomain.hostedZoneName', hostedZoneName);
      expect(() => {
        config.validate({ allowed: 'strict' });
      }).toThrow(error);
    }

    // Test cases
    expectFailure(
      goodDomainName,
      undefined,
      undefined,
      undefined,
      'domainName and certificateArn are required when using customDomain'
    );
    expectFailure(
      undefined,
      goodAcmArn,
      undefined,
      undefined,
      'domainName and certificateArn are required when using customDomain'
    );
    expectFailure(
      goodDomainName,
      goodAcmArn,
      goodHostedZoneId,
      undefined,
      'If you specify one of hostedZoneId and hostedZoneName, you must specify the other.'
    );
    expectFailure(
      goodDomainName,
      goodAcmArn,
      undefined,
      goodHostedZoneName,
      'If you specify one of hostedZoneId and hostedZoneName, you must specify the other.'
    );
    expectFailure(badDomainName, goodAcmArn, undefined, undefined, 'Invalid domain name');
    expectFailure(goodDomainName, badAcmArn, undefined, undefined, 'Invalid certificateArn');
    expectFailure(goodDomainName, goodAcmArn, badHostedZoneId, goodHostedZoneName, 'Invalid hostedZoneId');
    expectFailure(goodDomainName, goodAcmArn, goodHostedZoneId, badHostedZoneName, 'Invalid hostedZoneName');
    expectFailure(
      undefined,
      undefined,
      goodHostedZoneId,
      goodHostedZoneName,
      'domainName and certificateArn are required when using customDomain'
    );

    // Two valid test cases
    // 1. All fields set
    config.set('customDomain.domainName', goodDomainName);
    config.set('customDomain.certificateArn', goodAcmArn);
    config.set('customDomain.hostedZoneId', goodHostedZoneId);
    config.set('customDomain.hostedZoneName', goodHostedZoneName);
    config.validate({ allowed: 'strict' });
    // 2. Hosted zone id and name not set
    config.set('customDomain.hostedZoneId', undefined);
    config.set('customDomain.hostedZoneName', undefined);
    config.validate({ allowed: 'strict' });
  });

  it('handles valid gov acm arns', () => {
    const config = convict(convictSchema);
    // need the any here because convict doesn't resolve the type properly -.-
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodDomainName: any = 'idcentergamma.digitalevidencearchive.com';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goodAcmArn: any =
      'arn:aws-us-gov:acm:us-gov-east-1:012345678910:certificate/864569eb-8eed-4fc7-891a-d54fedb8808b';

    config.set('customDomain.domainName', goodDomainName);
    config.set('customDomain.certificateArn', goodAcmArn);
    config.validate({ allowed: 'strict' });
  });

  it('throws when admin arn is invalid', () => {
    const config = convict(convictSchema);
    // need the any here because convict doesn't resolve the type properly -.-
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badAdminArn: any = 'arn:aws:BAD::012345678910:role/Admin';

    config.set('adminRoleArn', badAdminArn);
    expect(() => {
      config.validate({ allowed: 'strict' });
    }).toThrow('Invalid admin role arn');
  });

  it('handles valid admin arn', () => {
    const config = convict(convictSchema);
    // need the any here because convict doesn't resolve the type properly -.-
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminArn: any = 'arn:aws:iam::012345678910:role/Admin';

    config.set('adminRoleArn', adminArn);
    config.validate({ allowed: 'strict' });
    expect(config.get('adminRoleArn')).toStrictEqual(adminArn);
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
});
