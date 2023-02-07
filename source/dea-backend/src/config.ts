/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
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

const groupArrayFormat: convict.Format = {
  name: 'group-array',
  validate: function (groups, schema) {
    if (!Array.isArray(groups)) {
      throw new Error('must be of type Array');
    }

    for (const group of groups) {
      convict(schema.groups).load(group).validate();
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
      format: String,
      default: undefined,
    },
  },
  userGroups: {
    doc: 'User Pool Groups config',
    format: groupArrayFormat.name,
    default: [],

    groups: {
      name: {
        doc: 'User pool group name',
        format: String,
        default: null,
      },
      description: {
        doc: 'User pool group description',
        format: String,
        default: null,
      },
      precedence: {
        doc: 'User pool group precedence',
        format: Number,
        default: null,
      },
      endpoints: {
        doc: 'Endpoints that the user group has access to',
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

export interface DEAEndpointDefinition {
  readonly path: string;
  readonly method: string;
}

export interface DEAUserPoolGroupDefinition {
  readonly name: string;
  readonly description: string;
  readonly precedence: number;
  readonly endpoints: DEAEndpointDefinition[];
}

convict.addFormat(groupArrayFormat);
convict.addFormat(endpointArrayFormat);

interface DEAConfig {
  stage(): string;
  configName(): string | undefined;
  region(): string;
  cognitoDomain(): string | undefined;
  userGroups(): DEAUserPoolGroupDefinition[];
}

const convictConfig = convict(convictSchema);

//wrap convict with some getters to be more friendly
export const deaConfig: DEAConfig = {
  stage: () => convictConfig.get('stage'),
  configName: () => convictConfig.get('configname'),
  region: () => convictConfig.get('region'),
  cognitoDomain: () => convictConfig.get('cognito.domain'),
  userGroups: () => convictConfig.get('userGroups'),
};

export const loadConfig = (stage: string): void => {
  const sourceDir = getSourcePath();
  convictConfig.loadFile(`${sourceDir}/common/config/${stage}.json`);
  convictConfig.validate({ allowed: 'strict' });
};
const configFilename = deaConfig.configName() ?? deaConfig.stage();
loadConfig(configFilename);
