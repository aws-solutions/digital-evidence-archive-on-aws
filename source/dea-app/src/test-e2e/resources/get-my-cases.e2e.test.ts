/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseAction } from '../../models/case-action';
import { CaseStatus } from '../../models/case-status';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase, deleteCaseUserForCases, getUlidForUser } from './test-helpers';

describe('get my cases api', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'getMyCasesTestUser';
  const deaApiUrl = envSettings.apiUrlOutput;
  const region = envSettings.awsRegion;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'GetMyCasesTestGroup', "GetMyCases", "TestUser");
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  }, 20000);

  it('should return the user\'s cases and cases they are invited to', async () => {
    // Create two cases owned by the user
    // then a case owned by another user who invites our user to it
    // Check that all 3 are returned for GetMyCases

    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    // Create 2 Cases owned by the user
    const ownedCaseIds: string[] = [];
    const caseNames = ['getMyCases-OwnedCase1', 'getMyCases-OwnedCase2'];
    const createdCases: DeaCase[] = [];
    for (const caseName of caseNames) {
      createdCases.push(
        await createCaseSuccess(
          deaApiUrl,
          {
            name: caseName,
            status: CaseStatus.ACTIVE,
            description: 'some case description',
          },
          idToken,
          creds
        )
      );
    }
    createdCases.forEach((createdCase) => ownedCaseIds.push(createdCase.ulid ?? fail()));

    const userUlid = await getUlidForUser(idToken, region);

    // Create cases owned by another user, then invite the test user to it
    const otherTestUser = "getMyCasesOtherTestUser"
    await cognitoHelper.createUser(otherTestUser, 'GetMyCasesTestGroup', "Other", "TestUser");
    const [creds2, idToken2] = await cognitoHelper.getCredentialsForUser(otherTestUser);

    const invitedCaseName = "getMyCases-InvitedCase";
    const invitedCase: DeaCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: invitedCaseName,
        status: CaseStatus.ACTIVE,
        description: 'case created by other user, which user will be invited to',
      },
      idToken2,
      creds2
    );
    const invitedCaseId = invitedCase.ulid ?? fail();
    // Now invited the original user
    await callDeaAPIWithCreds(`${deaApiUrl}cases/${invitedCaseId}/userMemberships`, "POST", idToken2, creds2, {
      userUlid: userUlid,
      caseUlid: invitedCaseId,
      actions: [CaseAction.VIEW_CASE_DETAILS],
    });

    // Now call get my cases for the first user, all four should be returned
    const getResponse = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, "GET", idToken, creds);

    expect(getResponse.status).toEqual(200);

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fetchedCases = (await getResponse.data.cases) as DeaCase[];
    expect(fetchedCases.length).toBe(3);
    fetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseResponseSchema));
    expect(fetchedCases.find((deacase) => deacase.name === caseNames[0])).toBeDefined();
    expect(fetchedCases.find((deacase) => deacase.name === caseNames[1])).toBeDefined();
    expect(fetchedCases.find((deacase) => deacase.name === invitedCaseName)).toBeDefined();


    // Now GetMyCases for the second user (who owns a cases but is not invited to any),
    // should only return the case they created
    const otherUserCases = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, "GET", idToken2, creds2);
    expect(otherUserCases.status).toEqual(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const otherUserFetchedCases = (await otherUserCases.data.cases) as DeaCase[];
    expect(otherUserFetchedCases.length).toBe(1);
    otherUserFetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseResponseSchema));
    expect(otherUserFetchedCases.find((deacase) => deacase.name === invitedCaseName)).toBeDefined();

    // clean up cases
    await deleteCases(ownedCaseIds, deaApiUrl, idToken, creds, region);
    await deleteCases([invitedCaseId], deaApiUrl, idToken2, creds2, region);
    // clean up case user from the case invitation
    // Note: deleteCase from testHelper already removes the 
    // case user for the owner, so we only need to remove the user from
    // the case they were invited too
    await deleteCaseUserForCases([invitedCaseId], userUlid);

    // Get My Cases for both users should be empty
    const user1Cases = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, "GET", idToken, creds);
    expect(user1Cases.status).toEqual(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const user1FetchedCases = (await user1Cases.data.cases) as DeaCase[];
    expect(user1FetchedCases.length).toBe(0);

    const user2Cases = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, "GET", idToken2, creds2);
    expect(user2Cases.status).toEqual(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const user2FetchedCases = (await user2Cases.data.cases) as DeaCase[];
    expect(user2FetchedCases.length).toBe(0);
    
  }, 60000);
})

const deleteCases = async (caseIdsToDelete: string[], deaApiUrl: string, idToken: string, creds: Credentials, region: string) => {
  for (const caseId of caseIdsToDelete) {
    await deleteCase(deaApiUrl, caseId, idToken, creds, region);
  }
};
