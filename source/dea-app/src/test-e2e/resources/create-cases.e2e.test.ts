/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { CaseStatus } from '../../models/case-status';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';
import { callDeaAPI, callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

describe('create cases api', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'createCaseTestUser';
  const deaApiUrl = envSettings.apiUrlOutput;

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'CreateCasesTestGroup', "CreateCases", "TestUser");
  });

  afterAll(async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, idToken, creds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  it('should create a new case', async () => {
    const [creds, idToken]  = await cognitoHelper.getCredentialsForUser(testUser);

    const caseName = 'CASE B';

    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        status: CaseStatus.ACTIVE,
        description: 'this is a description',
      },
      idToken,
      creds
    );

    caseIdsToDelete.push(createdCase.ulid ?? fail());
  }, 30000);

  it('should give an error when payload is missing', async () => {
    const response = await callDeaAPI(testUser, `${deaApiUrl}cases`, cognitoHelper, "POST", undefined);

    expect(response.status).toEqual(400);
  });

  it('should give an error when the name is in use', async () => {
    const [creds, idToken]  = await cognitoHelper.getCredentialsForUser(testUser);

    const caseName = 'CASE C';
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        status: CaseStatus.ACTIVE,
        description: 'any description',
      },
      idToken,
      creds
    );

    caseIdsToDelete.push(createdCase.ulid ?? fail());

    const response = await callDeaAPIWithCreds(`${deaApiUrl}cases`, "POST", idToken, creds,
      {
        name: caseName,
        status: 'ACTIVE',
        description: 'any description',
      });

    expect(response.status).toEqual(500);
  }, 30000);
});
