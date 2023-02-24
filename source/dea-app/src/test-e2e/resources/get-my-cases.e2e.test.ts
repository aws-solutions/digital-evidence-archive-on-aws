/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseAction } from '../../models/case-action';
import { DeaUser } from '../../models/user';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase, randomSuffix } from './test-helpers';

describe('get my cases api', () => {
  const cognitoHelper = new CognitoHelper();
  const user1CaseIds: string[] = [];
  const user2CaseIds: string[] = [];
  const otherTestUser = 'getMyCasesOtherTestUser';

  const testUser = 'getMyCasesTestUser';
  const user1FirstName = `GetMyCases${randomSuffix()}`;
  const user2FirstName = `Other${randomSuffix()}`;
  const deaApiUrl = testEnv.apiUrlOutput;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'GetMyCasesTestGroup', user1FirstName, 'TestUser');
  });

  afterAll(async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
    const [creds2, idToken2] = await cognitoHelper.getCredentialsForUser(otherTestUser);
    // clean up any cases leftover during a failure
    await deleteCases(user1CaseIds, deaApiUrl, idToken, creds);
    await deleteCases(user2CaseIds, deaApiUrl, idToken2, creds2);
    await cognitoHelper.cleanup();
  }, 20000);

  it("should return the user's cases and cases they are invited to", async () => {
    // Create two cases owned by the user
    // then a case owned by another user who invites our user to it
    // Check that all 3 are returned for GetMyCases

    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    // Create 2 Cases owned by the user
    const caseNames = ['getMyCases-OwnedCase1', 'getMyCases-OwnedCase2'];
    const createdCases: DeaCase[] = [];
    for (const caseName of caseNames) {
      createdCases.push(
        await createCaseSuccess(
          deaApiUrl,
          {
            name: caseName,
            description: 'some case description',
          },
          idToken,
          creds
        )
      );
    }
    createdCases.forEach((createdCase) => user1CaseIds.push(createdCase.ulid ?? fail()));

    // Create cases owned by another user, then invite the test user to it
    await cognitoHelper.createUser(otherTestUser, 'GetMyCasesTestGroup', user2FirstName, 'TestUser');
    const [creds2, idToken2] = await cognitoHelper.getCredentialsForUser(otherTestUser);

    const invitedCaseName = 'getMyCases-InvitedCase';
    const invitedCase: DeaCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: invitedCaseName,
        description: 'case created by other user, which user will be invited to',
      },
      idToken2,
      creds2
    );
    const invitedCaseId = invitedCase.ulid ?? fail();
    user2CaseIds.push(invitedCaseId);

    // Get the user ulid
    const userResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}users?nameBeginsWith=${user1FirstName}`,
      'GET',
      idToken,
      creds
    );

    expect(userResponse.status).toEqual(200);
    const fetchedUsers: DeaUser[] = await userResponse.data.users;

    const firstUser = fetchedUsers.find((user) => user.firstName === user1FirstName);
    if (!firstUser) {
      fail();
    }

    // Now invited the original user
    await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${invitedCaseId}/userMemberships`,
      'POST',
      idToken2,
      creds2,
      {
        userUlid: firstUser.ulid,
        caseUlid: invitedCaseId,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      }
    );

    // Now call get my cases for the first user, all four should be returned
    const getResponse = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken, creds);

    expect(getResponse.status).toEqual(200);

    const fetchedCases: DeaCase[] = await getResponse.data.cases;
    expect(fetchedCases.length).toBe(3);
    fetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseResponseSchema));
    expect(fetchedCases.find((deacase) => deacase.name === caseNames[0])).toBeDefined();
    expect(fetchedCases.find((deacase) => deacase.name === caseNames[1])).toBeDefined();
    expect(fetchedCases.find((deacase) => deacase.name === invitedCaseName)).toBeDefined();

    // Now GetMyCases for the second user (who owns a cases but is not invited to any),
    // should only return the case they created
    const otherUserCases = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken2, creds2);
    expect(otherUserCases.status).toEqual(200);

    const otherUserFetchedCases: DeaCase[] = await otherUserCases.data.cases;
    expect(otherUserFetchedCases.length).toBe(1);
    otherUserFetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseResponseSchema));
    expect(otherUserFetchedCases.find((deacase) => deacase.name === invitedCaseName)).toBeDefined();

    await deleteCases(user1CaseIds, deaApiUrl, idToken, creds);
    await deleteCases(user2CaseIds, deaApiUrl, idToken2, creds2);

    // Get My Cases for both users should be empty
    const user1Cases = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken, creds);
    expect(user1Cases.status).toEqual(200);

    const user1FetchedCases: DeaCase[] = await user1Cases.data.cases;
    expect(user1FetchedCases.length).toBe(0);

    const user2Cases = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken2, creds2);
    expect(user2Cases.status).toEqual(200);

    const user2FetchedCases: DeaCase[] = await user2Cases.data.cases;
    expect(user2FetchedCases.length).toBe(0);
  }, 60000);
});

const deleteCases = async (
  caseIdsToDelete: string[],
  deaApiUrl: string,
  idToken: string,
  creds: Credentials
) => {
  for (const caseId of caseIdsToDelete) {
    await deleteCase(deaApiUrl, caseId, idToken, creds);
  }
};
