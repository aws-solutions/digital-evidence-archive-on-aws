/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDeaUserFromToken, getTokenPayload } from '../cognito-token-helpers';
import CognitoHelper from '../test-e2e/helpers/cognito-helper';
import { testEnv } from '../test-e2e/helpers/settings';

describe('cognito helpers integration test', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'cognitoHelpersIntegrationTestUser';
  const firstName = 'CognitoTokenHelper';
  const lastName = 'TestUser';
  const region = testEnv.awsRegion;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should decode and return payload for valid token', async () => {
    const idToken = await cognitoHelper.getIdTokenForUser(testUser);

    const payload = await getTokenPayload(idToken, region);

    expect(payload.iss).toStrictEqual('https://' + cognitoHelper._idpUrl);
    expect(payload.aud).toStrictEqual(cognitoHelper._userPoolClientId);
    expect(payload.token_use).toStrictEqual('id');
  });

  it('should fail when SSM params do not exist', async () => {
    const idToken = await cognitoHelper.getIdTokenForUser(testUser);

    const fakeRegion = region === 'us-east-1' ? 'us-east-2' : 'us-east-1';

    await expect(getTokenPayload(idToken, fakeRegion)).rejects.toThrow(
      'Unable to grab the parameters in SSM needed for token verification.'
    );
  });

  it('should fail if token is modified', async () => {
    const token = await cognitoHelper.getIdTokenForUser(testUser);

    const replacementIndex = token.length / 2;
    const replacementChar = token.charAt(replacementIndex) === 'A' ? 'B' : 'A';
    const modifiedToken =
      token.substring(0, replacementIndex) + replacementChar + token.substring(replacementIndex + 1);

    await expect(getTokenPayload(modifiedToken, region)).rejects.toThrow('Unable to verify id token: ');
  });

  it('should decode and return a DeaUserInput from the token', async () => {
    const token = await cognitoHelper.getIdTokenForUser(testUser);
    const tokenPayload = await getTokenPayload(token, region);

    const deaUser = await getDeaUserFromToken(tokenPayload);

    expect(deaUser).toBeDefined();

    expect(deaUser.tokenId).toStrictEqual((await getTokenPayload(token, region)).sub);
    expect(deaUser.firstName).toStrictEqual(firstName);
    expect(deaUser.lastName).toStrictEqual(lastName);
  });

  it('should fail when first/last name not in id token', async () => {
    const token = await cognitoHelper.getIdTokenForUser(testUser);
    const tokenPayload = await getTokenPayload(token, region);

    delete tokenPayload['given_name'];
    await expect(getDeaUserFromToken(tokenPayload)).rejects.toThrow(
      'First and/or last name not given in id token.'
    );

    tokenPayload['given_name'] = firstName;
    delete tokenPayload['family_name'];
    await expect(getDeaUserFromToken(tokenPayload)).rejects.toThrow(
      'First and/or last name not given in id token.'
    );
  });
});
