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
import { getCustomUserAgent, getRequiredEnv, getRequiredHeader } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { Oauth2Token } from '../../models/auth';
import { ThrottlingException } from '../exceptions/throttling-exception';
import { ValidationError } from '../exceptions/validation-exception';

const stage = getRequiredEnv('STAGE', 'devsample');
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

  const cognitoDomainPath = `/dea/${stage}-userpool-cognito-domain-param`;
  const clientIdPath = `/dea/${stage}-userpool-client-id-param`;
  const callbackUrlPath = `/dea/${stage}-client-callback-url-param`;
  const identityPoolIdPath = `/dea/${stage}-identity-pool-id-param`;
  const userPoolIdPath = `/dea/${stage}-userpool-id-param`;
  const agencyIdpNamePath = `/dea/${stage}-agency-idp-name`;

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
  const cognitoRegion = region.includes('gov') ? 'us-gov-west-1' : region;
  const cognitoIdentityClient = new CognitoIdentityClient({
    region: cognitoRegion,
    customUserAgent: getCustomUserAgent(),
  });

  const Logins = {
    [`cognito-idp.${cognitoRegion}.amazonaws.com/${cognitoParams.userPoolId}`]: idToken,
  };

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
  const clientSecretId = `/dea/${stage}/clientSecret`;

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
    // If using default API Gateway domain, include stage in path
    // Otherwise its a custom domain, DO NOT include stage.
    callbackUrl =
      origin.includes('amazonaws.com') || origin.includes('localhost')
        ? `${origin}/${stage}/ui/login`
        : `${origin}/ui/login`;
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
    logger.error('Unable to exchange authorization code', response);
    if (response.status === 400) {
      throw new ValidationError('Bad Request.');
    }
    if (response.status === 429) {
      throw new ThrottlingException('Too Many Requests');
    }
    throw new Error(`Request failed with status code ${response.status}`);
  }

  // Access token unused, removed for cookie size limit
  if (response.data.access_token && response.data.token_type) {
    delete response.data.access_token;
    delete response.data.token_type;
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
    logger.error('Unable to use refresh token for new id token', response);
    if (response.status === 400) {
      throw new ValidationError('Bad Request.');
    }
    if (response.status === 429) {
      throw new ThrottlingException('Too Many Requests');
    }
    throw new Error(`Request failed with status code ${response.status}`);
  }

  // Oauth2/Token does not return refresh token when grant_type is refresh
  // Append refresh token so response.data can be used to update oauth cookie
  response.data['refresh_token'] = refreshToken;

  // Access token unused, removed for cookie size limit
  if (response.data.access_token && response.data.token_type) {
    delete response.data.access_token;
    delete response.data.token_type;
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
    logger.error('Unable to revoke refresh code', response);
    if (response.status === 400) {
      throw new ValidationError('Bad Request.');
    }
    if (response.status === 429) {
      throw new ThrottlingException('Too Many Requests');
    }
    throw new Error(`Request failed with status code ${response.status}`);
  }

  return response.status;
};

export const getAvailableEndpoints: AvailableEndpointsSignature = async (event) => {
  const deaRoleName = getRequiredHeader(event, 'deaRole');
  const ssmClient = new SSMClient({ region });
  const roleActionsPath = `/dea/${stage}-${deaRoleName}-actions`;
  const deleteAllowedParamPath = `/dea/${stage}/deletionAllowed`;
  const response = await ssmClient.send(
    new GetParametersCommand({
      Names: [roleActionsPath, deleteAllowedParamPath],
    })
  );

  const roleActionsParam = response.Parameters?.find((parameter) => parameter.Name === roleActionsPath);
  const roleActionsList = roleActionsParam?.Value?.split(',') ?? [];

  const deletionAllowedParam = response.Parameters?.find(
    (parameter) => parameter.Name === deleteAllowedParamPath
  );
  const deletionAllowed = deletionAllowedParam?.Value ?? 'false';
  if (deletionAllowed === 'true' && roleActionsList.includes('/cases/{caseId}/statusPUT')) {
    roleActionsList.push('/cases/{caseId}/filesDELETE');
  }
  return roleActionsList;
};
