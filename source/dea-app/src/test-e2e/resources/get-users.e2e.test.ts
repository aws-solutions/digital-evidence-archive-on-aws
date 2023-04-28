/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { Oauth2Token } from '../../models/auth';
import { DeaUser } from '../../models/user';
import { userResponseSchema } from '../../models/validation/user';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, randomSuffix } from './test-helpers';

describe('get users api', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix();
  const testUser = 'getUsersE2EUser';
  const testUser2 = 'getUsersE2EUser2';
  const user1FirstName = `GetUsersE2E${suffix}`;
  const user2FirstName = `GetUsersE2E${suffix}-2`;
  const testUser_blocked = 'notGranted_getUsersE2EUser';
  const deaApiUrl = testEnv.apiUrlOutput;

  let creds: Credentials;
  let idToken: Oauth2Token;
  let creds2: Credentials;
  let idToken2: Oauth2Token;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'CaseWorker', user1FirstName, 'TestUser');
    await cognitoHelper.createUser(testUser2, 'CaseWorker', user2FirstName, 'TestUser');
    await cognitoHelper.createUser(testUser_blocked, 'NoPermissionsGroup', 'NoAccessToUsers', 'TestUser');

    const credentials = await cognitoHelper.getCredentialsForUser(testUser);
    creds = credentials[0];
    idToken = credentials[1];
    const credentials2 = await cognitoHelper.getCredentialsForUser(testUser2);
    creds2 = credentials2[0];
    idToken2 = credentials2[1];
    // Call an api to add this user to the DB
    await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken, creds);
    await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken2, creds2);
  }, 30000);

  afterAll(async () => {
    await cognitoHelper.cleanup();
  }, 30000);

  it('should get all users', async () => {
    const response = await callDeaAPIWithCreds(
      `${deaApiUrl}users?nameBeginsWith=${user1FirstName}`,
      'GET',
      idToken,
      creds
    );

    expect(response.status).toEqual(200);
    const users: DeaUser[] = await response.data.users;
    users.forEach((user) => Joi.assert(user, userResponseSchema));

    //Both users in the DB are found
    expect(users.find((user) => user.firstName === user1FirstName)).toBeDefined();
    expect(users.find((user) => user.firstName === user2FirstName)).toBeDefined();
  }, 20000);

  it('should block unauthorized users', async () => {
    const [creds2, idToken2] = await cognitoHelper.getCredentialsForUser(testUser_blocked);

    const response = await callDeaAPIWithCreds(`${deaApiUrl}users`, 'GET', idToken2, creds2);

    expect(response.status).toEqual(403);
  }, 20000);
});
