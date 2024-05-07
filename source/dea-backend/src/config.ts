/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { RemovalPolicy } from 'aws-cdk-lib';
import { CorsOptions } from 'aws-cdk-lib/aws-apigateway';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import convict from 'convict';
// https://www.npmjs.com/package/convict

const FG_RED = '\x1b[31m';
const FG_RESET = '\x1b[0m';
const FG_GREEN = '\x1b[32m';

export function getSourcePath(): string {
  const pathParts = __dirname.split(path.sep);
  let backTrack = '';
  while (pathParts.length > 0 && pathParts.pop() !== 'source') {
    backTrack += '/..';
  }
  return `${__dirname}${backTrack}`;
}

export const REGIONS: Map<string, string> = new Map([
  ['US East (Ohio)', 'us-east-2'],
  ['US East (N. Virginia)', 'us-east-1'],
  ['US West (N. California)', 'us-west-1'],
  ['US West (Oregon)', 'us-west-2'],
  ['AWS GovCloud (US-East)*', 'us-gov-east-1'],
  ['AWS GovCloud (US-West)', 'us-gov-west-1'],
  ['Canada (Central)', 'ca-central-1'],
  ['Europe (Paris)', 'eu-west-3'],
  ['Europe (London)', 'eu-west-2'],
  ['Europe (Frankfurt)', 'eu-central-1'],
  ['Europe (Stockholm)', 'eu-north-1'],
  ['Europe (Ireland)', 'eu-west-1'],
  ['Europe (Milan)', 'eu-south-1'],
  ['Asia Pacific (Mumbai)', 'ap-south-1'],
  ['Asia Pacific (Seoul)', 'ap-northeast-2'],
  ['Asia Pacific (Singapore)', 'ap-southeast-1'],
  ['Asia Pacific (Sydney)', 'ap-southeast-2'],
  ['Asia Pacific (Tokyo)', 'ap-northeast-1'],
  ['South America (São Paulo)', 'sa-east-1'],
  ['Africa (Cape Town)', 'af-south-1'],
  ['Middle East (Bahrain)', 'me-south-1'],
]);

const REGION_REGEX = `(${Array.from(REGIONS.values()).join('|')})`;
function arnRegexBuilder(service: string, suffix: string): RegExp {
  return new RegExp(`^arn:(aws|aws-us-gov):${service}:${REGION_REGEX}:[0-9]{12}:${suffix}`);
}

// The following regex taken from http://stackoverflow.com/questions/10306690/domain-name-validation-with-regex/26987741#26987741
export const DOMAIN_REGEX = RegExp(
  '^(((?!-))(xn--|_)?[a-z0-9-]{0,61}[a-z0-9]{1,1}.)*(xn--)?([a-z0-9][a-z0-9-]{0,60}|[a-z0-9-]{1,30}.[a-z]{2,})$'
);
export const ACM_REGEX = arnRegexBuilder('acm', 'certificate/[a-zA-Z0-9-_]+');
export const HOSTED_ZONE_ID_REGEX = RegExp('^Z[A-Z0-9]{7,32}$');
export const HOSTED_ZONE_NAME_REGEX = RegExp('^[a-z0-9][a-z0-9-]{0,60}|[a-z0-9-]{1,30}.[a-z]{2,}$');
export const customDomainFormat: convict.Format = {
  name: 'custom-domain',
  validate: function (customDomain) {
    if (customDomain.domainName || customDomain.certificateArn) {
      if (!customDomain.domainName || !customDomain.certificateArn) {
        throw new Error('domainName and certificateArn are required when using customDomain');
      }

      if (!DOMAIN_REGEX.test(customDomain.domainName)) {
        throw new Error('Invalid domain name');
      }

      if (!ACM_REGEX.test(customDomain.certificateArn)) {
        throw new Error('Invalid certificateArn');
      }

      if (customDomain.hostedZoneId || customDomain.hostedZoneName) {
        if (!customDomain.hostedZoneId || !customDomain.hostedZoneName) {
          throw new Error(
            'If you specify one of hostedZoneId and hostedZoneName, you must specify the other.'
          );
        }
        if (!HOSTED_ZONE_ID_REGEX.test(customDomain.hostedZoneId)) {
          throw new Error('Invalid hostedZoneId');
        }
        if (!HOSTED_ZONE_NAME_REGEX.test(customDomain.hostedZoneName)) {
          throw new Error('Invalid hostedZoneName');
        }
      }
    } else {
      if (customDomain.hostedZoneId || customDomain.hostedZoneName) {
        throw new Error('domainName and certificateArn are required when using customDomain');
      }
    }
  },
};

export const deaRoleTypesFormat: convict.Format = {
  name: 'dea-role-types',
  validate: function (deaRoles, schema) {
    if (!Array.isArray(deaRoles)) {
      throw new Error('must be of type Array');
    }

    for (const deaRole of deaRoles) {
      convict(schema.deaRoles).load(deaRole).validate();
    }
  },
};

export const SubnetMaskCIDRFormat: convict.Format = {
  name: 'subnet-mask-cidr-format',
  validate: function (val) {
    if (typeof val !== 'number') {
      throw new Error('Source IP CIDR must be of type number');
    }
    if (val < 0 || val > 32) {
      throw new Error('Source IP CIDR must be between 0 and 32');
    }
  },
};

export const groupDeaRoleRulesFormat: convict.Format = {
  name: 'group-to-dearole-rules',
  validate: function (mappingRules, schema) {
    if (!Array.isArray(mappingRules)) {
      throw new Error('groupToDeaRoleRules must be of type Array');
    }

    if (mappingRules.length > 25) {
      throw new Error('You can only define up to 25 rule mappings.');
    }

    for (const mappingRule of mappingRules) {
      convict(schema.mappingRules).load(mappingRule).validate();
    }
  },
};

export const endpointArrayFormat: convict.Format = {
  name: 'endpoint-array',
  validate: function (endpoints, schema) {
    if (!Array.isArray(endpoints)) {
      throw new Error('must be of type Array');
    }

    for (const endpoint of endpoints) {
      convict(schema.endpoint).load(endpoint).validate();
    }
  },
};

export const cognitoDomainFormat: convict.Format = {
  name: 'cognito-domain',
  validate: function (val) {
    if (typeof val !== 'string') {
      throw new Error('The Cognito domain value must be a string.');
    }
    if (!/^[a-z0-9-]+$/.test(val)) {
      throw new Error('Cognito domain may only contain lowercase alphanumerics and hyphens.');
    }

    if (val.includes('aws') || val.includes('amazon') || val.includes('cognito')) {
      throw new Error('You cannot use aws, amazon, or cognito in the cognito domain prefix.');
    }
  },
};

const STAGE_MAX_LENGTH = 21;
export const deaStageFormat: convict.Format = {
  name: 'dea-stage',
  validate: function (val) {
    if (typeof val !== 'string') {
      throw new Error('The Stage value must be a string');
    }
    if (val.length > STAGE_MAX_LENGTH) {
      throw new Error('The Stage name must not exceed 21 characters');
    }
    if (!/^[a-zA-Z0-9-]+$/.test(val)) {
      throw new Error('The Stage name may only contain alphanumerics and hyphens.');
    }
  },
};

export const uploadTimeoutFormat: convict.Format = {
  name: 'upload-timeout',
  validate: function (val) {
    if (typeof val !== 'number') {
      throw new Error('The Upload Timeout value must be a number');
    }
    if (val < 0) {
      throw new Error('The Upload Timeout value must be a positive number');
    }
    if (val > 60) {
      throw new Error('The Upload Timeout value must be less than 60 minutes');
    }
  },
};

export const ADMIN_ROLE_ARN_REGEX = new RegExp(`^arn:(aws|aws-us-gov):iam::[0-9]{12}:role/[a-zA-Z0-9-_]+`);

export const convictSchema = {
  stage: {
    doc: 'the deployment stage, used as the name for the CloudFormation Stacks',
    format: deaStageFormat.name,
    default: 'devsample',
    env: 'STAGE',
  },
  configname: {
    doc: 'the deployment configuration filename. This is optional, by default it will use the stage name',
    format: String,
    default: undefined,
    env: 'CONFIGNAME',
  },
  region: {
    doc: 'the AWS region for deployment',
    format: Array.from(REGIONS.values()),
    default: 'us-east-1',
    env: 'AWS_REGION',
  },
  cognito: {
    domain: {
      doc: 'used for the userpool',
      format: cognitoDomainFormat.name,
      default: undefined,
      env: 'DOMAIN_PREFIX',
      required: true,
    },
  },
  customDomain: {
    doc: 'Custom Domain config',
    format: customDomainFormat.name,
    default: {
      domainName: undefined,
      certificateArn: undefined,
      hostedZoneId: undefined,
      hostedZoneName: undefined,
    },

    domainName: {
      doc: 'Custom domain for solution',
      default: undefined,
    },
    certificateArn: {
      doc: 'The reference to an AWS-managed certificate for the domain name',
      default: undefined,
    },
    hostedZoneId: {
      doc: 'The id for the hosted zone for the domain',
      default: undefined,
    },
    hostedZoneName: {
      doc: 'The name of the hosted zone',
      default: undefined,
    },
  },
  vpcEndpoint: {
    vpcEndpointId: {
      doc: 'VPC endpoint of private deployment of DEA',
      format: String,
      default: undefined,
    },
    vpcId: {
      doc: 'VPC in which to deploy DEA',
      format: String,
      default: undefined,
    },
  },
  idpInfo: {
    metadataPath: {
      doc: 'Either the URL or file path to the IDP metadata',
      format: String,
      default: undefined,
    },
    metadataPathType: {
      doc: 'Either the URL or file path to the IDP metadata',
      format: String,
      default: 'FILE',
    },
    attributeMap: {
      username: {
        doc: 'name of the IDP attribute field to get the logon of the user',
        format: String,
        default: 'username',
      },
      email: {
        doc: 'name of the IDP attribute field to get the email of the user',
        format: String,
        default: 'email',
      },
      firstName: {
        doc: 'name of the IDP attribute field to get the first name of the user',
        format: String,
        default: 'firstName',
      },
      lastName: {
        doc: 'name of the IDP attribute field to get the last name of the user',
        format: String,
        default: 'lastName',
      },
      deaRoleName: {
        doc: 'name of the IDP attribute field to get the role to use for user. Either set this or use the groups attribute and define the rule mappings',
        format: String,
        default: undefined,
      },
      groups: {
        doc: 'name of the IDP attribute field to get the group memberships of the user',
        format: String,
        default: undefined,
      },
      idcenterid: {
        doc: 'ONLY used for Identity Center, this is the user id to query for users group memberships',
        format: String,
        default: undefined,
      },
    },
    defaultRole: {
      doc: "Default role to assign to users that don't match the other roles",
      format: String,
      default: undefined,
    },
    groupToDeaRoleRules: {
      doc: 'define the role mapping rules for user membership to defined DEARole which defines access to the system',
      format: groupDeaRoleRulesFormat.name,
      default: [],

      mappingRules: {
        filterValue: {
          doc: 'string to search for E.g. Troop',
          format: String,
          default: null,
        },
        deaRoleName: {
          doc: 'DEA Role Type name to assign this group of users',
          format: String,
          default: null,
        },
      },
    },
    identityStoreId: {
      doc: `identity store of your identity center instance, used for querying user's group memberships`,
      // TODO: add regex
      format: String,
      default: undefined,
    },
    identityStoreRegion: {
      doc: `region of your identity center instance, used for querying user's group memberships`,
      format: String,
      default: undefined,
    },
    identityStoreAccountId: {
      doc: 'The AWS account Id where your identity center instance is deployed',
      format: String,
      default: undefined,
    },
    hasAwsManagedActiveDirectory: {
      doc: `whether your identity center's identity store is AWS Managed Microsoft AD`,
      format: Boolean,
      default: false,
    },
  },
  testStack: {
    doc: 'Boolean to indicate if this is a test stack',
    format: Boolean,
    default: false,
  },
  isOneClick: {
    doc: 'Boolean to indicate if this is a One Click Deployment',
    format: Boolean,
    default: false,
  },
  sourceIpValidation: {
    doc: 'Boolean to indicate if pre-signed url access should be ip-restricted',
    format: Boolean,
    default: true,
  },
  sourceIpSubnetMaskCIDR: {
    doc: 'Subnet mask for source ip validation',
    format: SubnetMaskCIDRFormat.name,
    default: 32,
  },
  deaRoleTypes: {
    doc: 'DEA Role Types config',
    format: deaRoleTypesFormat.name,
    default: [],

    deaRoles: {
      name: {
        doc: 'DEA Role Type name',
        format: String,
        default: null,
      },
      description: {
        doc: 'DEA Role type description',
        format: String,
        default: null,
      },
      endpoints: {
        doc: 'Endpoints that the users of the role have access to',
        format: endpointArrayFormat.name,
        default: [],

        endpoint: {
          path: {
            doc: 'API path to resource',
            format: String,
            default: null,
          },
          method: {
            doc: 'API method for the specified path',
            format: ['POST', 'PUT', 'DELETE', 'GET'],
            default: null,
          },
        },
      },
    },
  },
  deaAllowedOrigins: {
    doc: 'Comma separated list of allowed domains',
    format: String,
    default: '',
  },
  deletionAllowed: {
    doc: 'Boolean to indicate if Delete Case Handler should be deployed or not',
    format: 'Boolean',
    default: false,
  },
  fipsEndpointsEnabled: {
    doc: 'Whether to use the FIPS-compliant endpoints',
    format: 'Boolean',
    default: true,
  },
  isMultiRegionTrail: {
    doc: 'Whether or not this trail delivers log files from multiple regions to a single S3 bucket for a single account',
    format: 'Boolean',
    default: true,
  },
  uploadFilesTimeoutMinutes: {
    doc: 'Timeout in minutes for S3 pre-signed URLs generated for file upload',
    format: uploadTimeoutFormat.name,
    default: 60,
  },
  includeDynamoDataPlaneEventsInTrail: {
    doc: 'Boolean to indicate if DynamoDB Data-plane events should be included in the audit CloudTrail',
    format: 'Boolean',
    default: true,
  },
  auditDownloadTimeoutMinutes: {
    doc: 'Timeout in minutes for S3 pre-signed URLs generated for audit CSV download',
    format: Number,
    default: 60,
  },
  adminRoleArn: {
    doc: 'Optional ARN to grant KMS and Bucket permissions, useful for pipeline testing',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    format: function check(val: any) {
      if (val === undefined) {
        return;
      }
      if (!ADMIN_ROLE_ARN_REGEX.test(val)) {
        throw new Error('Invalid admin role arn');
      }
    },
    default: undefined,
    env: 'ADMIN_ROLE_ARN',
  },
};

export interface GroupToDEARoleRule {
  readonly filterValue: string;
  readonly deaRoleName: string;
}

export interface IdPAttributes {
  readonly username: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly deaRoleName: string | undefined;
  readonly groups: string | undefined;
  readonly idcenterid: string | undefined;
}

export interface IdpMetadataInfo {
  readonly metadataPath: string | undefined;
  readonly metadataPathType: string;
  readonly attributeMap: IdPAttributes;
  readonly defaultRole: string | undefined;
  readonly groupToDeaRoleRules: GroupToDEARoleRule[];
  readonly identityStoreId: string | undefined;
  readonly identityStoreRegion: string | undefined;
  readonly identityStoreAccountId: string | undefined;
  readonly hasAwsManagedActiveDirectory: boolean;
}

export interface DEAEndpointDefinition {
  readonly path: string;
  readonly method: string;
}

export interface DEARoleTypeDefinition {
  readonly name: string;
  readonly description: string;
  readonly endpoints: DEAEndpointDefinition[];
}

export interface CustomDomainInfo {
  readonly domainName: string | undefined;
  readonly certificateArn: string | undefined;
  readonly hostedZoneId: string | undefined;
  readonly hostedZoneName: string | undefined;
}

export interface VpcEndpointInfo {
  readonly vpcEndpointId: string | undefined;
  readonly vpcId: string | undefined;
}

convict.addFormat(groupDeaRoleRulesFormat);
convict.addFormat(customDomainFormat);
convict.addFormat(deaRoleTypesFormat);
convict.addFormat(endpointArrayFormat);
convict.addFormat(cognitoDomainFormat);
convict.addFormat(deaStageFormat);
convict.addFormat(uploadTimeoutFormat);
convict.addFormat(SubnetMaskCIDRFormat);

interface DEAConfig {
  stage(): string;
  configName(): string | undefined;
  region(): string;
  partition(): string;
  cognitoDomain(): string | undefined;
  customDomainInfo(): CustomDomainInfo;
  vpcEndpointInfo(): VpcEndpointInfo | undefined;
  isTestStack(): boolean;
  isOneClick(): boolean;
  sourceIpValidationEnabled(): boolean;
  sourceIpSubnetMaskCIDR(): string;
  deaRoleTypes(): DEARoleTypeDefinition[];
  retainPolicy(): RemovalPolicy;
  retentionDays(): RetentionDays;
  idpMetadata(): IdpMetadataInfo | undefined;
  deaAllowedOrigins(): string;
  deaAllowedOriginsList(): string[];
  kmsAccountActions(): string[];
  deletionAllowed(): boolean;
  sameSiteValue(): string;
  preflightOptions(): CorsOptions | undefined;
  fipsEndpointsEnabled(): boolean;
  isMultiRegionTrail(): boolean;
  uploadFilesTimeoutMinutes(): number;
  includeDynamoDataPlaneEventsInTrail(): boolean;
  auditDownloadTimeoutMinutes(): number;
  adminRoleArn(): string | undefined;
}

export const convictConfig = convict(convictSchema);

//wrap convict with some getters to be more friendly
export const deaConfig: DEAConfig = {
  stage: () => convictConfig.get('stage'),
  configName: () => convictConfig.get('configname'),
  region: () => convictConfig.get('region'),
  partition: () => {
    const region = convictConfig.get('region');
    return region.includes('us-gov') ? 'aws-us-gov' : 'aws';
  },
  cognitoDomain: () => convictConfig.get('cognito.domain'),
  customDomainInfo: () => convictConfig.get('customDomain'),
  isTestStack: () => convictConfig.get('testStack'),
  isOneClick: () => convictConfig.get('isOneClick'),
  sourceIpValidationEnabled: () => convictConfig.get('sourceIpValidation'),
  sourceIpSubnetMaskCIDR: () => convictConfig.get('sourceIpSubnetMaskCIDR').toString(),
  deaRoleTypes: () => convictConfig.get('deaRoleTypes'),
  retainPolicy: () => (convictConfig.get('testStack') ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN),
  retentionDays: () => (convictConfig.get('testStack') ? RetentionDays.TWO_WEEKS : RetentionDays.INFINITE),
  idpMetadata: () => convictConfig.get('idpInfo'),
  deaAllowedOrigins: () => convictConfig.get('deaAllowedOrigins'),
  deaAllowedOriginsList: () => {
    const value = convictConfig.get('deaAllowedOrigins');
    return value === '' ? [] : value.split(',');
  },
  kmsAccountActions: () => [
    'kms:Create*',
    'kms:Describe*',
    'kms:Enable*',
    'kms:List*',
    'kms:Put*',
    'kms:Update*',
    'kms:Revoke*',
    'kms:Disable*',
    'kms:Get*',
    'kms:Delete*',
    'kms:TagResource',
    'kms:UntagResource',
    'kms:ScheduleKeyDeletion',
    'kms:CancelKeyDeletion',
  ],
  deletionAllowed: () => convictConfig.get('deletionAllowed'),
  sameSiteValue: () => (convictConfig.get('testStack') ? 'None' : 'Strict'),
  preflightOptions: () => {
    const allowOrigins = deaConfig.deaAllowedOriginsList();
    if (deaConfig.customDomainInfo().domainName) {
      allowOrigins.push(`https://${deaConfig.customDomainInfo().domainName}`);
    }

    if (allowOrigins.length > 0) {
      return {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'CSRF-Token',
          'x-amz-security-token',
          'set-cookie',
          'Host',
          'Content-Length',
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins,
      };
    }

    return undefined;
  },
  vpcEndpointInfo: () => {
    const vpcEndpoint = convictConfig.get('vpcEndpoint');
    if (!vpcEndpoint || !vpcEndpoint.vpcEndpointId || !vpcEndpoint.vpcId) {
      return undefined;
    }
    return vpcEndpoint;
  },
  fipsEndpointsEnabled: () => convictConfig.get('fipsEndpointsEnabled') ?? true,
  isMultiRegionTrail: () => convictConfig.get('isMultiRegionTrail') ?? true,
  uploadFilesTimeoutMinutes: () => convictConfig.get('uploadFilesTimeoutMinutes'),
  includeDynamoDataPlaneEventsInTrail: () => convictConfig.get('includeDynamoDataPlaneEventsInTrail'),
  auditDownloadTimeoutMinutes: () => convictConfig.get('auditDownloadTimeoutMinutes'),
  adminRoleArn: () => convictConfig.get('adminRoleArn'),
};

export const loadConfig = (stage: string): void => {
  const sourceDir = getSourcePath();
  convictConfig.loadFile(`${sourceDir}/common/config/${stage}.json`);
  try {
    convictConfig.validate({ allowed: 'strict' });
  } catch (e) {
    console.error(
      [
        `${FG_RED}--------------------------------------------------------------------------------------`,
        `Configuration ${stage}.json Failed Schema Validation:`,
        `${e.message}`,
        `--------------------------------------------------------------------------------------${FG_RESET}`,
      ].join('\n')
    );
    throw e;
  }
  console.info(
    [
      `${FG_GREEN}--------------------------------------------------------------------------------------`,
      `Configuration ${stage}.json Passed Schema Validation`,
      `--------------------------------------------------------------------------------------${FG_RESET}`,
    ].join('\n')
  );
};
const configFilename = deaConfig.configName() ?? deaConfig.stage();
loadConfig(configFilename);
