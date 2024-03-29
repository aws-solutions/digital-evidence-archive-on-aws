/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '../logger';

export const PARAM_PREFIX = '/dea/1/';

const PARAMETERS_SECRETS_EXTENSION_HTTP_PORT = 2773;

export interface ParametersProvider {
  getSecretValue(secretName: string): Promise<string>;
  getSsmParameterValue(parameterPath: string): Promise<string>;
}

type SsmParameterResponse = {
  ARN: string;
  DataType: string;
  LastModifiedDate: number;
  Name: string;
  Selector: string;
  SourceResult: string;
  Type: string;
  Value: string;
  Version: number;
};

const secretsEndpoint = `http://localhost:${PARAMETERS_SECRETS_EXTENSION_HTTP_PORT}/secretsmanager/get?secretId=`;
const ssmEndpoint = `http://localhost:${PARAMETERS_SECRETS_EXTENSION_HTTP_PORT}/systemsmanager/parameters/get/?name=`;
const RETRIES = 3;
const SLEEP_IN_MS = 10;
export const defaultParametersProvider: ParametersProvider = {
  async getSecretValue(secretName: string): Promise<string> {
    const url = `${secretsEndpoint}${secretName}`;
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    if (!sessionToken) {
      logger.error('Session token is undefined, cannot retrieve secrets value');
      throw new Error('Cannot retrieve paramter, misconfigured lambda.');
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Aws-Parameters-Secrets-Token': sessionToken,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error occured while requesting secret ${secretName}. Responses status was ${response.status}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const secretContent = (await response.json()) as { SecretString: string };
    return secretContent.SecretString;
  },
  async getSsmParameterValue(parameterPath: string): Promise<string> {
    const url = `${ssmEndpoint}${parameterPath}`;
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    if (!sessionToken) {
      logger.error('Session token is undefined, cannot retrieve secrets value');
      throw new Error('Cannot retrieve paramter, misconfigured lambda.');
    }

    for (let i = 0; i < RETRIES; i++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Aws-Parameters-Secrets-Token': sessionToken,
          },
        });

        if (!response.ok) {
          if (response.statusText.includes('ParameterNotFound')) {
            throw new Error('Parameter does not exist.');
          } else {
            await sleep(SLEEP_IN_MS);
            continue;
          }
        }

        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const parameterContent = (await response.json()) as { Parameter: SsmParameterResponse };
        return parameterContent.Parameter.Value;
      } catch (e) {
        logger.info(`Caught error trying to retrieve param ${parameterPath}:`, e);
        await sleep(SLEEP_IN_MS);
      }
    }

    throw new Error('Unable to obtain parameter from SSM');
  },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
