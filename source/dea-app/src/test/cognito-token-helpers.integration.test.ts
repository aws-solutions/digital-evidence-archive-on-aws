/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDeaUserFromToken, getExpirationTimeFromToken } from '../cognito-token-helpers';
import CognitoHelper from '../test-e2e/helpers/cognito-helper';
import { randomSuffix } from '../test-e2e/resources/test-helpers';

describe('cognito helpers integration test', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testUser = `cognitoHelpersIntegrationTestUser${suffix}`;
  const firstName = 'CognitoTokenHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should decode and return payload for valid token', async () => {
    const { id_token, refresh_token } = await cognitoHelper.getIdTokenForUser(testUser);

    const payload = await cognitoHelper.getTokenPayload(id_token);

    expect(payload.iss).toStrictEqual('https://' + cognitoHelper.idpUrl);
    expect(payload.aud).toStrictEqual(cognitoHelper.userPoolClientId);
    expect(refresh_token).toBeTruthy();
    expect(payload.token_use).toStrictEqual('id');
  });

  it('should fail if token is modified', async () => {
    const { id_token } = await cognitoHelper.getIdTokenForUser(testUser);

    const replacementIndex = id_token.length / 2;
    const replacementChar = id_token.charAt(replacementIndex) === 'A' ? 'B' : 'A';
    const modifiedToken =
      id_token.substring(0, replacementIndex) + replacementChar + id_token.substring(replacementIndex + 1);

    await expect(cognitoHelper.getTokenPayload(modifiedToken)).rejects.toThrow('Unable to verify id token: ');
  });

  it('should decode and return a DeaUserInput from the token', async () => {
    const { id_token } = await cognitoHelper.getIdTokenForUser(testUser);
    const tokenPayload = await cognitoHelper.getTokenPayload(id_token);
    const idPoolId = 'ID_POOL_ID';

    const deaUser = await getDeaUserFromToken(tokenPayload, idPoolId);

    expect(deaUser).toBeDefined();

    expect(deaUser.tokenId).toStrictEqual((await cognitoHelper.getTokenPayload(id_token)).sub);
    expect(deaUser.idPoolId).toStrictEqual(idPoolId);
    expect(deaUser.firstName).toStrictEqual(firstName);
    expect(deaUser.lastName).toStrictEqual(lastName);
  });

  it('should fail when first/last name not in id token', async () => {
    const { id_token } = await cognitoHelper.getIdTokenForUser(testUser);
    const tokenPayload = await cognitoHelper.getTokenPayload(id_token);
    const idPoolId = 'ID_POOL_ID';

    delete tokenPayload['given_name'];
    await expect(getDeaUserFromToken(tokenPayload, idPoolId)).rejects.toThrow(
      'First and/or last name not given in id token.'
    );

    tokenPayload['given_name'] = firstName;
    delete tokenPayload['family_name'];
    await expect(getDeaUserFromToken(tokenPayload, idPoolId)).rejects.toThrow(
      'First and/or last name not given in id token.'
    );
  });

  it('should return a ID Token expiration time from the token', async () => {
    const { id_token } = await cognitoHelper.getIdTokenForUser(testUser);
    const tokenPayload = await cognitoHelper.getTokenPayload(id_token);

    tokenPayload['exp'] = 10000;
    tokenPayload['iat'] = 9000;
    const expirationTime = getExpirationTimeFromToken(tokenPayload);

    expect(expirationTime).toStrictEqual(1000);
  });
});
