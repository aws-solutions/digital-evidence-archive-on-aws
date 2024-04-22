/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import { getCustomUserAgent } from '@aws/dea-app/lib/lambda-http-helpers';
import { getLogoutUrl, refreshToken, revokeToken } from '../api/auth';

export interface Credentials {
  AccessKeyId: string;
  SecretKey: string;
  SessionToken: string;
}

export const getCallbackUrl = () => {
  let callbackUrl = '';
  if (typeof window !== 'undefined') {
    callbackUrl = `${window.location}`.replace(/\/ui(.*)/, '/ui/login');
  }
  return callbackUrl;
};

function clearStorage() {
  sessionStorage.clear();
  localStorage.removeItem('username');
}

export const signOutProcess = async () => {
  try {
    await revokeToken();
  } catch (e) {
    console.log('Error revoking token, refresh token may be expired already:', e);
  }

  clearStorage();

  // Logout of cognito session and redirect to login page
  const callbackUrl = getCallbackUrl();
  const logoutUrl = await getLogoutUrl(callbackUrl);

  return logoutUrl;
};

export const refreshCredentials = async () => {
  const response = await refreshToken();
  const credentials = await getCredentialsByToken(
    response.idToken,
    response.identityPoolId,
    response.userPoolId
  );
  sessionStorage.setItem('accessKeyId', credentials.AccessKeyId);
  sessionStorage.setItem('secretAccessKey', credentials.SecretKey);
  sessionStorage.setItem('sessionToken', credentials.SessionToken);
  sessionStorage.setItem('tokenExpirationTime', calculateExpirationDate(response.expiresIn).toString());
};

export const getCredentialsByToken = async (idToken: string, identityPoolId: string, userPoolId: string) => {
  const region = identityPoolId.substring(0, identityPoolId.indexOf(':'));
  const cognitoRegion = region.includes('gov') ? 'us-gov-west-1' : region;
  const fipsSupported = process.env.NEXT_PUBLIC_FIPS_SUPPORTED === 'true';
  // Set up the Cognito Identity client
  const cognitoIdentityClient = new CognitoIdentityClient({
    region: cognitoRegion,
    useFipsEndpoint: fipsSupported,
    customUserAgent: getCustomUserAgent(),
  });

  // Set up the request parameters
  const Logins: Record<string, string> = {
    [`cognito-idp.${cognitoRegion}.amazonaws.com/${userPoolId}`]: idToken,
  };

  const getIdCommand = new GetIdCommand({
    IdentityPoolId: identityPoolId,
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

  if (!Credentials || !Credentials.AccessKeyId || !Credentials.SecretKey || !Credentials.SessionToken) {
    throw new Error('Credentials not found');
  }
  const credentials: Credentials = {
    AccessKeyId: Credentials.AccessKeyId,
    SecretKey: Credentials.SecretKey,
    SessionToken: Credentials.SessionToken,
  };

  return credentials;
};

export const calculateExpirationDate = (expirationTime: number) => {
  // expiration time is in seconds, we add time by milliseconds so multiply by 1000
  const timestamp = Date.now() + expirationTime * 1000;
  return timestamp;
};
