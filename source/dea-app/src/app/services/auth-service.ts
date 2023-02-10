/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import axios from 'axios';
import { getRequiredEnv } from '../../lambda-http-helpers';

const stage = getRequiredEnv('STAGE', 'chewbacca');
const region = getRequiredEnv('AWS_REGION', 'us-east-1');

export async function getSSMParam(ssmClient: SSMClient, paramPath: string) {
  const cmd = new GetParametersCommand({
    Names: [paramPath],
  });

  const result = await ssmClient.send(cmd);

  if (result.Parameters && result.Parameters[0]) {
    return result.Parameters[0].Value;
  } else {
    throw new Error(`Parameter not found: ${paramPath}`);
  }
}

export const getCognitoSsmParams = async (): Promise<[string, string, string]> => {
  const ssmClient = new SSMClient({ region });

  const cognitoDomainPath = `/dea/${region}/${stage}-userpool-cognito-domain-param`;
  const clientIdPath = `/dea/${region}/${stage}-userpool-client-id-param`;
  const callbackUrlPath = `/dea/${region}/${stage}-client-callback-url-param`;

  const cognitoDomainUrl = await getSSMParam(ssmClient, cognitoDomainPath);
  const clientId = await getSSMParam(ssmClient, clientIdPath);
  const callbackUrl = await getSSMParam(ssmClient, callbackUrlPath);

  if (cognitoDomainUrl && clientId && callbackUrl) {
    return [cognitoDomainUrl, clientId, callbackUrl];
  } else {
    throw new Error('Unable to grab the parameters in SSM needed for token verification.');
  }
};

export const exchangeAuthorizationCode = async (authorizationCode: string): Promise<string> => {
  const [cognitoDomain, clientId, callbackUrl] = await getCognitoSsmParams();
  const axiosInstance = axios.create({
    baseURL: cognitoDomain,
  });

  const data = new URLSearchParams();
  data.append('grant_type', 'authorization_code');
  data.append('client_id', clientId);
  data.append('code', authorizationCode);
  data.append('redirect_uri', callbackUrl);

  // make a request using the Axios instance
  const response = await axiosInstance.post('/oauth2/token', data, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data.id_token;
};
