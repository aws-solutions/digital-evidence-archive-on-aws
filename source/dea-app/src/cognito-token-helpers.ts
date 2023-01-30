/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { SSMClient, GetParametersCommand } from '@aws-sdk/client-ssm';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { ValidationError } from './app/exceptions/validation-exception';
import { DeaUser } from './models/user';

export const getTokenPayload = async (idToken: string, region: string): Promise<CognitoIdTokenPayload> => {
  const ssmClient = new SSMClient({ region });
  const userPoolIdPath = `/dea/${region}/userpool-id-param`;
  const clientIdPath = `/dea/${region}/userpool-client-id-param`;
  const response = await ssmClient.send(
    new GetParametersCommand({
      Names: [userPoolIdPath, clientIdPath],
    })
  );

  if (
    !response.Parameters ||
    response.Parameters?.length != 2 ||
    !response.Parameters[0].Value ||
    !response.Parameters[1].Value
  ) {
    throw new Error('Unable to grab the parameters in SSM needed for token verification.');
  }

  const userPoolId =
    response.Parameters[0].Name === userPoolIdPath
      ? response.Parameters[0].Value
      : response.Parameters[1].Value;
  const clientId =
    response.Parameters[0].Name === clientIdPath
      ? response.Parameters[0].Value
      : response.Parameters[1].Value;
  const verifier = CognitoJwtVerifier.create({
    userPoolId: userPoolId,
    tokenUse: 'id',
    clientId: clientId,
  });

  try {
    return await verifier.verify(idToken);
  } catch (error) {
    throw new ValidationError('Unable to verify id token: ' + error);
  }
};

export const getDeaUserFromToken = async (idTokenPayload: CognitoIdTokenPayload): Promise<DeaUser> => {
  if (!idTokenPayload['given_name'] || !idTokenPayload['family_name']) {
    throw new ValidationError('First and/or last name not given in id token.');
  }
  const deaUser: DeaUser = {
    tokenId: idTokenPayload.sub,
    firstName: idTokenPayload['given_name'] + '',
    lastName: idTokenPayload['family_name'] + '',
  };

  return deaUser;
};
