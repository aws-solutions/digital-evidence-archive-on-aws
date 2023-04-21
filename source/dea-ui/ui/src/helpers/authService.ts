/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';

const region = process.env.REGION ?? 'us-east-1';

export interface Credentials {
  AccessKeyId: string;
  SecretKey: string;
  SessionToken: string;
}

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
