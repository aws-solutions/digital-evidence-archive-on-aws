/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { ValidationError } from '../app/exceptions/validation-exception';
import { getCustomUserAgent } from '../lambda-http-helpers';
import { ParametersProvider } from '../storage/parameters';
import { testEnv } from '../test-e2e/helpers/settings';

const secretsClient = new SecretsManagerClient({
  region: testEnv.awsRegion,
  customUserAgent: getCustomUserAgent(),
});
const ssmClient = new SSMClient({ region: testEnv.awsRegion, customUserAgent: getCustomUserAgent() });

export const testParametersProvider: ParametersProvider = {
  async getSecretValue(secretName: string): Promise<string> {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });
    const response = await secretsClient.send(command);

    if (response.SecretString) {
      return response.SecretString;
    } else {
      throw new ValidationError(`Cognito secret ${secretName} not found!`);
    }
  },
  async getSsmParameterValue(parameterPath: string): Promise<string> {
    const command = new GetParameterCommand({
      Name: parameterPath,
    });
    const response = await ssmClient.send(command);

    if (!response.Parameter?.Value) {
      throw new ValidationError(`SSM Parameter ${parameterPath} not found!`);
    }

    return response.Parameter.Value;
  },
};
