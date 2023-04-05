/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import convict from 'convict';
// https://www.npmjs.com/package/convict

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
    default: 'chewbacca',
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
        doc: 'name of the IDP attribute field to get the last name of the user',
        format: String,
        default: 'email',
      },
      firstName: {
        doc: 'name of the IDP attribute field to get the last name of the user',
        format: String,
        default: 'firstName',
      },
      lastName: {
        doc: 'name of the IDP attribute field to get the last name of the user',
        format: String,
        default: 'lastName',
      },
      deaRoleName: {
        doc: 'name of the IDP attribute field to get the last name of the user',
        format: String,
        default: 'deaRoleName',
      },
    },
  },
  testStack: {
    doc: 'Boolean to indicate if this is a test stack',
    format: Boolean,
    default: false,
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
};

export interface IdPAttributes {
  readonly username: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly deaRoleName: string;
}

export interface IdpMetadataInfo {
  readonly metadataPath: string | undefined;
  readonly metadataPathType: string;
  readonly attributeMap: IdPAttributes;
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

convict.addFormat(deaRoleTypesFormat);
convict.addFormat(endpointArrayFormat);
convict.addFormat(cognitoDomainFormat);

interface DEAConfig {
  stage(): string;
  configName(): string | undefined;
  region(): string;
  cognitoDomain(): string | undefined;
  isTestStack(): boolean;
  deaRoleTypes(): DEARoleTypeDefinition[];
  retainPolicy(): RemovalPolicy;
  retentionDays(): RetentionDays;
  idpMetadata(): IdpMetadataInfo | undefined;
}

export const convictConfig = convict(convictSchema);

//wrap convict with some getters to be more friendly
export const deaConfig: DEAConfig = {
  stage: () => convictConfig.get('stage'),
  configName: () => convictConfig.get('configname'),
  region: () => convictConfig.get('region'),
  cognitoDomain: () => convictConfig.get('cognito.domain'),
  isTestStack: () => convictConfig.get('testStack'),
  deaRoleTypes: () => convictConfig.get('deaRoleTypes'),
  retainPolicy: () => (convictConfig.get('testStack') ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN),
  retentionDays: () => (convictConfig.get('testStack') ? RetentionDays.TWO_WEEKS : RetentionDays.INFINITE),
  idpMetadata: () => convictConfig.get('idpInfo'),
};

export const loadConfig = (stage: string): void => {
  const sourceDir = getSourcePath();
  convictConfig.loadFile(`${sourceDir}/common/config/${stage}.json`);
  convictConfig.validate({ allowed: 'strict' });
};
const configFilename = deaConfig.configName() ?? deaConfig.stage();
loadConfig(configFilename);
