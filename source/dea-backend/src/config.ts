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

const UNDEFINED_STRING = 'undefined';

function getSourcePath(): string {
  const pathParts = __dirname.split(path.sep);
  let backTrack = '';
  while (pathParts.length > 0 && pathParts.pop() !== 'source') {
    backTrack += '/..';
  }
  return `${__dirname}${backTrack}`;
}

const deaRoleTypesFormat: convict.Format = {
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

const groupDeaRoleRulesFormat: convict.Format = {
  name: 'group-to-dearole-rules',
  validate: function (mappingRules, schema) {
    if (!Array.isArray(mappingRules)) {
      throw new Error('must be of type Array');
    }

    if (mappingRules.length > 25) {
      throw new Error('You can only define up to 25 rule mappings.');
    }

    for (const mappingRule of mappingRules) {
      convict(schema.mappingRules).load(mappingRule).validate();
    }
  },
};

const endpointArrayFormat: convict.Format = {
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

const cognitoDomainFormat: convict.Format = {
  name: 'cognito-domain',
  validate: function (val) {
    if (!/^[a-z0-9-]+$/.test(val)) {
      throw new Error('Cognito domain may only contain lowercase alphanumerics and hyphens.');
    }
  },
};

const convictSchema = {
  stage: {
    doc: 'The deployment stage.',
    format: String,
    default: 'devsample',
    env: 'STAGE',
  },
  configname: {
    doc: 'The deployment configuration filename. This is optional, by default it will use the stage name.',
    format: String,
    default: undefined,
    env: 'CONFIGNAME',
  },
  region: {
    doc: 'The AWS region for deployment',
    format: String,
    default: 'us-east-1',
    env: 'AWS_REGION',
  },
  cognito: {
    domain: {
      doc: 'The cognito domain',
      format: cognitoDomainFormat.name,
      default: undefined,
      env: 'DOMAIN_PREFIX',
    },
  },
  customDomain: {
    domainName: {
      doc: 'Custom domain for solution',
      format: String,
      default: undefined,
    },
    certificateArn: {
      doc: 'The reference to an AWS-managed certificate for the domain name.',
      format: String,
      default: undefined,
    },
    hostedZoneId: {
      doc: 'The id for the hosted zone for the domain',
      format: String,
      default: undefined,
    },
    hostedZoneName: {
      doc: 'The name of the hosted zone',
      format: String,
      default: undefined,
    },
  },
  vpcEndpoint: {
    vpcEndpointId: {
      doc: 'VPC endpoint of private deployment of DEA',
      format: String,
      default: UNDEFINED_STRING,
    },
    vpcId: {
      doc: 'VPC in which to deploy DEA',
      format: String,
      default: UNDEFINED_STRING,
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
        doc: 'name of the IDP attribute field to get the role to use for user. Either set this or use the groups attribute and define the rule mappings.',
        format: String,
        default: undefined,
      },
      groups: {
        doc: 'name of the IDP attribute field to get the group memberships of the user',
        format: String,
        default: undefined,
      },
      idcenterid: {
        doc: 'ONLY used for Identity Center, this is the user id to query for users group memberships.',
        format: String,
        default: undefined,
      },
    },
    defaultRole: {
      doc: "Default role to assign to users that don't match the other roles.",
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
    doc: 'Whether or not this trail delivers log files from multiple regions to a single S3 bucket for a single account.',
    format: 'Boolean',
    default: true,
  },
  uploadFilesTimeoutMinutes: {
    doc: 'Timeout in minutes for S3 pre-signed URLs generated for file upload',
    format: Number,
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
  readonly vpcEndpointId: string;
  readonly vpcId: string;
}

convict.addFormat(groupDeaRoleRulesFormat);
convict.addFormat(deaRoleTypesFormat);
convict.addFormat(endpointArrayFormat);
convict.addFormat(cognitoDomainFormat);

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
  sourceIpValidationEnabled: () => convictConfig.get('sourceIpValidation') ?? true,
  deaRoleTypes: () => convictConfig.get('deaRoleTypes'),
  retainPolicy: () => (convictConfig.get('testStack') ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN),
  retentionDays: () => (convictConfig.get('testStack') ? RetentionDays.TWO_WEEKS : RetentionDays.INFINITE),
  idpMetadata: () => convictConfig.get('idpInfo'),
  deaAllowedOrigins: () => convictConfig.get('deaAllowedOrigins'),
  deaAllowedOriginsList: () => {
    const value = convictConfig.get('deaAllowedOrigins');
    return value === '' ? [] : value.split(',');
  },
  kmsAccountActions: () =>
    convictConfig.get('testStack')
      ? ['kms:*']
      : [
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

    return convictConfig.get('testStack')
      ? {
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
        }
      : undefined;
  },
  vpcEndpointInfo: () => {
    const vpcEndpoint = convictConfig.get('vpcEndpoint');
    if (
      !vpcEndpoint ||
      vpcEndpoint.vpcEndpointId === UNDEFINED_STRING ||
      vpcEndpoint.vpcId === UNDEFINED_STRING
    ) {
      return undefined;
    }
    return vpcEndpoint;
  },
  fipsEndpointsEnabled: () => convictConfig.get('fipsEndpointsEnabled') ?? true,
  isMultiRegionTrail: () => convictConfig.get('isMultiRegionTrail') ?? true,
  uploadFilesTimeoutMinutes: () => convictConfig.get('uploadFilesTimeoutMinutes'),
  includeDynamoDataPlaneEventsInTrail: () => convictConfig.get('includeDynamoDataPlaneEventsInTrail'),
  auditDownloadTimeoutMinutes: () => convictConfig.get('auditDownloadTimeoutMinutes'),
};

export const loadConfig = (stage: string): void => {
  const sourceDir = getSourcePath();
  convictConfig.loadFile(`${sourceDir}/common/config/${stage}.json`);
  convictConfig.validate({ allowed: 'strict' });
};
const configFilename = deaConfig.configName() ?? deaConfig.stage();
loadConfig(configFilename);
