/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetParameterCommand, GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { getCustomUserAgent } from '../lambda-http-helpers';
import { logger } from '../logger';

export const PARAM_PREFIX = '/dea/1/';

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1';

export interface ParametersProvider {
  getSecretValue(secretName: string): Promise<string>;
  getSsmParameterValue(parameterPath: string): Promise<string>;
  getSsmParametersValue(parameterPaths: string[]): Promise<(string | undefined)[]>;
}

const ssmClient = new SSMClient({ region, customUserAgent: getCustomUserAgent() });
const secretsClient = new SecretsManagerClient({ region, customUserAgent: getCustomUserAgent() });
export const defaultParametersProvider: ParametersProvider = {
  async getSecretValue(secretName: string): Promise<string> {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    try {
      const secretResponse = await secretsClient.send(command);

      if (secretResponse.SecretString) {
        return secretResponse.SecretString;
      } else {
        throw new Error(`Error occured while requesting secret ${secretName}.`);
      }
    } catch (e) {
      logger.error(`Failed to retrieve secret: ${secretName}`, e);
      throw new Error(`Failed to retrieve secret: ${secretName}`);
    }
  },
  async getSsmParameterValue(parameterPath: string): Promise<string> {
    const command = new GetParameterCommand({
      Name: parameterPath,
    });

    try {
      const paramResponse = await ssmClient.send(command);

      if (paramResponse.Parameter?.Value) {
        return paramResponse.Parameter.Value;
      } else {
        throw new Error(`Error occured while requesting parameter ${parameterPath}.`);
      }
    } catch (e) {
      logger.error(`Failed to retrieve parameter: ${parameterPath}`, e);
      throw new Error(`Failed to retrieve parameter: ${parameterPath}`);
    }
  },
  async getSsmParametersValue(parameterPaths: string[]): Promise<(string | undefined)[]> {
    const command = new GetParametersCommand({
      Names: parameterPaths,
    });

    try {
      const paramsResponse = await ssmClient.send(command);
      const params = paramsResponse.Parameters;

      if (!paramsResponse || !params) {
        logger.error(`Error occured while requesting parameters ${parameterPaths}.`, paramsResponse);
        throw new Error(`Error occured while requesting parameters ${parameterPaths}.`);
      }

      // Match up parameters to their values
      const values: (string | undefined)[] = parameterPaths.map(
        (path) => params.find((param) => param.Name === path)?.Value
      );
      return values;
    } catch (e) {
      logger.error(`Failed to retrieve parameters: ${parameterPaths}`, e);
      throw new Error(`Failed to retrieve parameters: ${parameterPaths}`);
    }
  },
};
