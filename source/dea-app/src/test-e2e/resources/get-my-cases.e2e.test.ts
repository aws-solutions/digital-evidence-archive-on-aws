/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

describe('get my cases api', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'getMyCasesTestUser';
  const deaApiUrl = envSettings.apiUrlOutput;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'GetMyCasesTestGroup', "GetMyCases", "TestUser");
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  }, 10000);

  it('should return the user\'s cases and cases they are invited to', async () => {
    // Create a case owned by another user, then invite the test user to it
    // Check that all 4 are returned

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

    // Create cases owned by another user, then invite the test user to it
    const otherTestUser = "getMyCasesOtherTestUser"
    await cognitoHelper.createUser(otherTestUser, 'GetMyCasesTestGroup', "Other", "TestUser");
    const [creds2, idToken2] = await cognitoHelper.getCredentialsForUser(otherTestUser);

    const invitedCaseIds: string[] = [];
    const caseNames2 = ['getMyCases-InvitedCase1', 'getMyCases-InvitedCase2'];
    const invitedCases: DeaCase[] = [];
    for (const caseName of caseNames2) {
      invitedCases.push(
        await createCaseSuccess(
          deaApiUrl,
          {
            name: caseName,
            status: CaseStatus.ACTIVE,
            description: 'some case description',
          },
          idToken2,
          creds2
        )
      );
    }
    invitedCases.forEach((createdCase) => invitedCaseIds.push(createdCase.ulid ?? fail()));
    // Now invite the user
    invitedCases.forEach((case) => );
    createCaseUserMembershipFromDTO = async (
      caseUserDto: CaseUserDTO,
      /* the default case is handled in e2e tests */
      /* istanbul ignore next */
      repositoryProvider = defaultProvider
    ): Promise<CaseUser>;
    

    const getResponse = await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, "GET", idToken, creds);

    expect(getResponse.status).toEqual(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fetchedCases = (await getResponse.data.cases) as DeaCase[];
    expect(fetchedCases.length).toBe(4);
    fetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseResponseSchema));

    // clean up cases
    await deleteCases(ownedCaseIds, deaApiUrl, idToken, creds);
    await deleteCases(invitedCaseIds, deaApiUrl, idToken2, creds2);

  }, 20000);
}

const deleteCases = async (caseIdsToDelete: string[], deaApiUrl: string, idToken: string, creds: Credentials) => {
  for (const caseId of caseIdsToDelete) {
    await deleteCase(deaApiUrl, caseId, idToken, creds);
  }
};
