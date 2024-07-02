/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import axios from 'axios';
import { getCustomUserAgent, getRequiredEnv } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { Oauth2Token } from '../../models/auth';
import { CacheProvider } from '../../storage/cache';
import { ParametersProvider } from '../../storage/parameters';
import { ThrottlingException } from '../exceptions/throttling-exception';
import { ValidationError } from '../exceptions/validation-exception';
import { getClientSecret, getCognitoSsmParams } from './parameter-service';

const stage = getRequiredEnv('STAGE');
const region = getRequiredEnv('AWS_REGION');
const fipsSupported = getRequiredEnv('AWS_USE_FIPS_ENDPOINT', 'false') === 'true';

export const getLoginHostedUiUrl = async (
  redirectUri: string,
  cacheProvider: CacheProvider,
  parametersProvider: ParametersProvider
) => {
  const cognitoParams = await getCognitoSsmParams(parametersProvider, cacheProvider);

  const oauth2AuthorizeEndpointUrl = `${cognitoParams.cognitoDomainUrl}/oauth2/authorize?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${redirectUri}`;

  if (cognitoParams.agencyIdpName) {
    return oauth2AuthorizeEndpointUrl + `&identity_provider=${cognitoParams.agencyIdpName}`;
  }

  return oauth2AuthorizeEndpointUrl;
};

export const getCognitoLogoutUrl = async (
  redirectUri: string,
  cacheProvider: CacheProvider,
  parametersProvider: ParametersProvider
) => {
  const cognitoParams = await getCognitoSsmParams(parametersProvider, cacheProvider);

  const cognitoLogoutUrl = `${cognitoParams.cognitoDomainUrl}/logout?response_type=code&client_id=${cognitoParams.clientId}&redirect_uri=${redirectUri}`;

  return cognitoLogoutUrl;
};

export const getCredentialsByToken = async (
  idToken: string,
  cacheProvider: CacheProvider,
  parametersProvider: ParametersProvider
) => {
  const cognitoParams = await getCognitoSsmParams(parametersProvider, cacheProvider);

  // Set up the Cognito Identity client
  const cognitoRegion = region.includes('gov') ? 'us-gov-west-1' : region;
  const cognitoIdentityClient = new CognitoIdentityClient({
    region: cognitoRegion,
    customUserAgent: getCustomUserAgent(),
    useFipsEndpoint: fipsSupported,
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

export const exchangeAuthorizationCode = async (
  authorizationCode: string,
  codeVerifier: string,
  cacheProvider: CacheProvider,
  parametersProvider: ParametersProvider,
  origin?: string,
  callbackOverride?: string
): Promise<[Oauth2Token, string, string]> => {
  const cognitoParams = await getCognitoSsmParams(parametersProvider, cacheProvider);
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

  const clientSecret = await getClientSecret(parametersProvider, cacheProvider);

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

export const useRefreshToken = async (
  refreshToken: string,
  cacheProvider: CacheProvider,
  parametersProvider: ParametersProvider
): Promise<[Oauth2Token, string, string]> => {
  const cognitoParams = await getCognitoSsmParams(parametersProvider, cacheProvider);
  const axiosInstance = axios.create({
    baseURL: cognitoParams.cognitoDomainUrl,
  });

  const clientSecret = await getClientSecret(parametersProvider, cacheProvider);

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

export const revokeRefreshToken = async (
  refreshToken: string,
  cacheProvider: CacheProvider,
  parametersProvider: ParametersProvider
) => {
  const cognitoParams = await getCognitoSsmParams(parametersProvider, cacheProvider);
  const axiosInstance = axios.create({
    baseURL: cognitoParams.cognitoDomainUrl,
  });

  const clientSecret = await getClientSecret(parametersProvider, cacheProvider);

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
