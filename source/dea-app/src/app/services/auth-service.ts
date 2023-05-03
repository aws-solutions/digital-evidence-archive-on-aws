/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { APIGatewayProxyEvent } from 'aws-lambda';
import axios from 'axios';
import { getRequiredEnv, getRequiredHeader } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { Oauth2Token } from '../../models/auth';
import { ValidationError } from '../exceptions/validation-exception';

const stage = getRequiredEnv('STAGE', 'chewbacca');
const region = getRequiredEnv('AWS_REGION', 'us-east-1');

export type AvailableEndpointsSignature = (event: APIGatewayProxyEvent) => Promise<string[]>;

export interface CognitoSsmParams {
  cognitoDomainUrl: string;
  clientId: string;
  callbackUrl: string;
  identityPoolId: string;
  userPoolId: string;
  agencyIdpName?: string;
}

let cachedCognitoParams: CognitoSsmParams;

export const getCognitoSsmParams = async (): Promise<CognitoSsmParams> => {
  if (cachedCognitoParams) {
    return cachedCognitoParams;
  }

  const ssmClient = new SSMClient({ region });

  const cognitoDomainPath = `/dea/${region}/${stage}-userpool-cognito-domain-param`;
  const clientIdPath = `/dea/${region}/${stage}-userpool-client-id-param`;
  const callbackUrlPath = `/dea/${region}/${stage}-client-callback-url-param`;
  const identityPoolIdPath = `/dea/${region}/${stage}-identity-pool-id-param`;
  const userPoolIdPath = `/dea/${region}/${stage}-userpool-id-param`;
  const agencyIdpNamePath = `/dea/${region}/${stage}-agency-idp-name`;

  const response = await ssmClient.send(
    new GetParametersCommand({
      Names: [
        cognitoDomainPath,
        clientIdPath,
        callbackUrlPath,
        identityPoolIdPath,
        userPoolIdPath,
        agencyIdpNamePath,
      ],
    })
  );

  if (!response.Parameters) {
    throw new Error(
      `No parameters found for: ${cognitoDomainPath}, ${clientIdPath}, ${callbackUrlPath}, ${identityPoolIdPath}, ${userPoolIdPath}, ${agencyIdpNamePath}`
    );
  }

  let cognitoDomainUrl;
  let clientId;
  let callbackUrl;
  let identityPoolId;
  let userPoolId;
  let agencyIdpName;

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
      case agencyIdpNamePath:
        agencyIdpName = param.Value;
        break;
    }
  });

  if (cognitoDomainUrl && clientId && callbackUrl && identityPoolId && userPoolId) {
    cachedCognitoParams = {
      cognitoDomainUrl,
      clientId,
      callbackUrl,
      identityPoolId,
      userPoolId,
      agencyIdpName,
    };
    return cachedCognitoParams;
  } else {
    throw new Error(
      `Unable to grab the parameters in SSM needed for token verification: ${cognitoDomainUrl}, ${clientId}, ${callbackUrl}, ${identityPoolId}`
    );
  }
};

export const getLoginHostedUiUrl = async (redirectUri: string) => {
  const cognitoParams = await getCognitoSsmParams();

  const oauth2AuthorizeEndpointUrl = `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${redirectUri}`;

  if (cognitoParams.agencyIdpName) {
    return oauth2AuthorizeEndpointUrl + `&identity_provider=${cognitoParams.agencyIdpName}`;
  }

  return oauth2AuthorizeEndpointUrl;
};

export const getCognitoLogoutUrl = async (redirectUri: string) => {
  const cognitoParams = await getCognitoSsmParams();

  const cognitoLogoutUrl = `${cognitoParams.cognitoDomainUrl}/logout?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${redirectUri}`;

  return cognitoLogoutUrl;
};

export const getCredentialsByToken = async (idToken: string) => {
  const cognitoParams = await getCognitoSsmParams();

  // Set up the Cognito Identity client
  const cognitoIdentityClient = new CognitoIdentityClient({
    region: region,
  });

  let Logins: Record<string, string>;
  if (region.includes('gov')) {
    // In us-gov-east, we have to redirect to us-gov-west because
    // Cognito is not available there
    Logins = {
      [`cognito-idp.us-gov-west-1.amazonaws.com/${cognitoParams.userPoolId}`]: idToken,
    };
  } else {
    Logins = {
      [`cognito-idp.${region}.amazonaws.com/${cognitoParams.userPoolId}`]: idToken,
    };
  }
  // Set up the request parameters
  const getIdCommand = new GetIdCommand({
    IdentityPoolId: cognitoParams.identityPoolId,
    Logins,
  });

  // Call the GetIdCommand to obtain the Cognito identity ID for the user
  const { IdentityId } = await cognitoIdentityClient.send(getIdCommand);
  // Set up the request parameters for the GetCredentialsForIdentityCommand
  const getCredentialsCommand = new GetCredentialsForIdentityCommand({
    IdentityId,
    Logins,
  });

  // Call the GetCredentialsForIdentityCommand to obtain temporary AWS credentials for the user
  const { Credentials } = await cognitoIdentityClient.send(getCredentialsCommand);
  return Credentials;
};

const getClientSecret = async () => {
  const clientSecretId = `/dea/${region}/${stage}/clientSecret`;

  const client = new SecretsManagerClient({ region: region });
  const input = {
    SecretId: clientSecretId,
  };
  const command = new GetSecretValueCommand(input);
  const secretResponse = await client.send(command);

  if (secretResponse.SecretString) {
    return secretResponse.SecretString;
  } else {
    throw new ValidationError(`Cognito secret ${clientSecretId} not found!`);
  }
};

export const exchangeAuthorizationCode = async (
  authorizationCode: string,
  codeVerifier: string,
  origin?: string,
  callbackOverride?: string
): Promise<[Oauth2Token, string, string]> => {
  const cognitoParams = await getCognitoSsmParams();
  const axiosInstance = axios.create({
    baseURL: cognitoParams.cognitoDomainUrl,
  });

  let callbackUrl = cognitoParams.callbackUrl;
  if (origin) {
    callbackUrl = `${origin}/${stage}/ui/login`;
  }
  if (callbackOverride) {
    callbackUrl = callbackOverride;
  }

  const clientSecret = await getClientSecret();

  const data = new URLSearchParams();
  data.append('grant_type', 'authorization_code');
  data.append('client_id', cognitoParams.clientId);
  data.append('code', authorizationCode);
  data.append('redirect_uri', callbackUrl);
  data.append('client_secret', clientSecret);

  if (codeVerifier) {
    data.append('code_verifier', codeVerifier);
  } else {
    throw new ValidationError(`Missing PKCE code verifier!`);
  }

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

  return [response.data, cognitoParams.identityPoolId, cognitoParams.userPoolId];
};

export const useRefreshToken = async (refreshToken: string): Promise<[Oauth2Token, string, string]> => {
  const cognitoParams = await getCognitoSsmParams();
  const axiosInstance = axios.create({
    baseURL: cognitoParams.cognitoDomainUrl,
  });

  const clientSecret = await getClientSecret();

  const data = new URLSearchParams();
  data.append('grant_type', 'refresh_token');
  data.append('client_id', cognitoParams.clientId);
  data.append('refresh_token', refreshToken);
  data.append('client_secret', clientSecret);

  // make a request using the Axios instance
  const response = await axiosInstance.post('/oauth2/token', data, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    logger.error(`Unable to use refresh token for new id token: ${response.statusText}`);
    throw new Error(`Request failed with status code ${response.status}`);
  }

  return [response.data, cognitoParams.identityPoolId, cognitoParams.userPoolId];
};

export const revokeRefreshToken = async (refreshToken: string) => {
  const cognitoParams = await getCognitoSsmParams();
  const axiosInstance = axios.create({
    baseURL: cognitoParams.cognitoDomainUrl,
  });

  const clientSecret = await getClientSecret();

  // Get encoded client ID for client secret support
  const encodedClientId = Buffer.from(`${cognitoParams.clientId}:${clientSecret}`).toString('base64');

  const data = new URLSearchParams();
  data.append('grant_type', 'authorization_code');
  data.append('client_id', cognitoParams.clientId);
  data.append('token', refreshToken);

  // make a request using the Axios instance
  const response = await axiosInstance.post('/oauth2/revoke', data, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${encodedClientId}`,
    },
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    logger.error(`Unable to revoke refresh code: ${response.statusText}`);
    throw new Error(`Request failed with status code ${response.status}`);
  }

  return response.status;
};

export const getAvailableEndpoints: AvailableEndpointsSignature = async (event) => {
  const deaRoleName = getRequiredHeader(event, 'deaRole');
  const ssmClient = new SSMClient({ region });
  const roleActionsPath = `/dea/${region}/${stage}-${deaRoleName}-actions`;
  const response = await ssmClient.send(
    new GetParametersCommand({
      Names: [roleActionsPath],
    })
  );

  const param = response.Parameters?.find((parameter) => parameter.Name === roleActionsPath);

  return param?.Value?.split(',') ?? [];
};
