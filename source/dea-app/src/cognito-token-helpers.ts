/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { CognitoIdTokenPayload } from 'aws-jwt-verify/jwt-model';
import { ValidationError } from './app/exceptions/validation-exception';
import { CognitoUserPoolInfo } from './app/services/parameter-service';
import { DeaUserInput } from './models/user';

export const getTokenPayload = async (
  idToken: string,
  userPoolInfo: CognitoUserPoolInfo
): Promise<CognitoIdTokenPayload> => {
  const verifier = CognitoJwtVerifier.create({
    userPoolId: userPoolInfo.userPoolId,
    tokenUse: 'id',
    clientId: userPoolInfo.clientId,
  });

  try {
    return await verifier.verify(idToken);
  } catch (error) {
    throw new ValidationError('Unable to verify id token: ' + error);
  }
};

export const getDeaUserFromToken = async (
  idTokenPayload: CognitoIdTokenPayload,
  idPoolId: string
): Promise<DeaUserInput> => {
  if (!idTokenPayload['given_name'] || !idTokenPayload['family_name']) {
    throw new ValidationError('First and/or last name not given in id token.');
  }
  const deaUser: DeaUserInput = {
    tokenId: idTokenPayload.sub,
    idPoolId,
    firstName: String(idTokenPayload['given_name']),
    lastName: String(idTokenPayload['family_name']),
  };

  return deaUser;
};

export const getExpirationTimeFromToken = (idTokenPayload: CognitoIdTokenPayload): number => {
  if (!idTokenPayload['iat'] || !idTokenPayload['exp']) {
    throw new ValidationError('Missing expiration and auth time');
  }
  const expirationTime = idTokenPayload['exp'] - idTokenPayload['iat'];

  return expirationTime;
};
