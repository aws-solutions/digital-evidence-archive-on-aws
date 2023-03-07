/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import axios from 'axios';
import { getRequiredEnv } from '../../lambda-http-helpers';
import { logger } from '../../logger';

const stage = getRequiredEnv('STAGE', 'chewbacca');
const region = getRequiredEnv('AWS_REGION', 'us-east-1');

export interface CognitoSsmParams {
  cognitoDomainUrl: string;
  clientId: string;
  callbackUrl: string;
  identityPoolId: string;
  userPoolId: string;
}

export const getCognitoSsmParams = async (): Promise<CognitoSsmParams> => {
  const ssmClient = new SSMClient({ region });

  const cognitoDomainPath = `/dea/${region}/${stage}-userpool-cognito-domain-param`;
  const clientIdPath = `/dea/${region}/${stage}-userpool-client-id-param`;
  const callbackUrlPath = `/dea/${region}/${stage}-client-callback-url-param`;
  const identityPoolIdPath = `/dea/${region}/${stage}-identity-pool-id-param`;
  const userPoolIdPath = `/dea/${region}/${stage}-userpool-id-param`;

  const response = await ssmClient.send(
    new GetParametersCommand({
      Names: [cognitoDomainPath, clientIdPath, callbackUrlPath, identityPoolIdPath, userPoolIdPath],
    })
  );

  if (!response.Parameters) {
    throw new Error(
      `No parameters found for: ${cognitoDomainPath}, ${clientIdPath}, ${callbackUrlPath}, ${identityPoolIdPath}, ${userPoolIdPath}`
    );
  }

  let cognitoDomainUrl;
  let clientId;
  let callbackUrl;
  let identityPoolId;
  let userPoolId;

  response.Parameters.forEach((param) => {
    switch (param.Name) {
      case cognitoDomainPath:
        cognitoDomainUrl = param.Value;
        break;
      case clientIdPath:
        clientId = param.Value;
        break;
      case callbackUrlPath:
        callbackUrl = param.Value;
        break;
      case identityPoolIdPath:
        identityPoolId = param.Value;
        break;
      case userPoolIdPath:
        userPoolId = param.Value;
        break;
    }
  });

  if (cognitoDomainUrl && clientId && callbackUrl && identityPoolId && userPoolId) {
    return {
      cognitoDomainUrl,
      clientId,
      callbackUrl,
      identityPoolId,
      userPoolId,
    };
  } else {
    throw new Error(
      `Unable to grab the parameters in SSM needed for token verification: ${cognitoDomainUrl}, ${clientId}, ${callbackUrl}, ${identityPoolId}`
    );
  }
};

export const getLoginHostedUiUrl = async () => {
  const cognitoParams = await getCognitoSsmParams();

  const loginUrl = `${cognitoParams.cognitoDomainUrl}/login?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${cognitoParams.callbackUrl}`;

  return loginUrl;
};

export const getCredentialsByToken = async (idToken: string) => {
  const cognitoParams = await getCognitoSsmParams();

  // Set up the Cognito Identity client
  const cognitoIdentityClient = new CognitoIdentityClient({
    region: region,
  });

  // Set up the request parameters
  const getIdCommand = new GetIdCommand({
    IdentityPoolId: cognitoParams.identityPoolId,
    Logins: {
      [`cognito-idp.${region}.amazonaws.com/${cognitoParams.userPoolId}`]: idToken,
    },
  });

  // Call the GetIdCommand to obtain the Cognito identity ID for the user
  const { IdentityId } = await cognitoIdentityClient.send(getIdCommand);
  // Set up the request parameters for the GetCredentialsForIdentityCommand
  const getCredentialsCommand = new GetCredentialsForIdentityCommand({
    IdentityId,
    Logins: {
      [`cognito-idp.${region}.amazonaws.com/${cognitoParams.userPoolId}`]: idToken,
    },
  });

  // Call the GetCredentialsForIdentityCommand to obtain temporary AWS credentials for the user
  const { Credentials } = await cognitoIdentityClient.send(getCredentialsCommand);
  return Credentials;
};

export const exchangeAuthorizationCode = async (
  authorizationCode: string,
  origin?: string
): Promise<string> => {
  const cognitoParams = await getCognitoSsmParams();
  const axiosInstance = axios.create({
    baseURL: cognitoParams.cognitoDomainUrl,
  });

  let callbackUrl = cognitoParams.callbackUrl;
  if (origin) {
    callbackUrl = `${origin}/${stage}/ui/login`;
  }

  const data = new URLSearchParams();
  data.append('grant_type', 'authorization_code');
  data.append('client_id', cognitoParams.clientId);
  data.append('code', authorizationCode);
  data.append('redirect_uri', callbackUrl);

  // make a request using the Axios instance
  const response = await axiosInstance.post('/oauth2/token', data, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    logger.error(
      `Unable to exchange authorization code: ${response.statusText} : ${JSON.stringify(response.data)}`
    );
    throw new Error(`Request failed with status code ${response.status}`);
  }

  return response.data.id_token;
};
