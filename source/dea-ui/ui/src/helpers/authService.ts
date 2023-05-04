/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import { getLogoutUrl, refreshToken, revokeToken } from '../api/auth';

const region = process.env.REGION ?? 'us-east-1';

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
  sessionStorage.removeItem('accessKeyId');
  sessionStorage.removeItem('secretAccessKey');
  sessionStorage.removeItem('sessionToken');
  sessionStorage.removeItem('pkceVerifier');
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
};

export const getCredentialsByToken = async (idToken: string, identityPoolId: string, userPoolId: string) => {
  // Set up the Cognito Identity client
  const cognitoIdentityClient = new CognitoIdentityClient({
    region: region,
  });

  // Set up the request parameters
  const getIdCommand = new GetIdCommand({
    IdentityPoolId: identityPoolId,
    Logins: {
      [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken,
    },
  });

  // Call the GetIdCommand to obtain the Cognito identity ID for the user
  const { IdentityId } = await cognitoIdentityClient.send(getIdCommand);

  // Set up the request parameters for the GetCredentialsForIdentityCommand
  const getCredentialsCommand = new GetCredentialsForIdentityCommand({
    IdentityId,
    Logins: {
      [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: idToken,
    },
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
