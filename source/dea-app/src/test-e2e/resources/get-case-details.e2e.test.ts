/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

describe('get case api', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'getCaseE2ETestUser';
  const deaApiUrl = testEnv.apiUrlOutput;
  let testUserCreds: Credentials;
  let testUserToken: string;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'GetCaseTestGroup', 'GetCase', 'TestUser');
    [testUserCreds, testUserToken] = await cognitoHelper.getCredentialsForUser(testUser);
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should get a created case', async () => {
    // Create Case
    const caseName = 'caseWithDetails';
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        status: CaseStatus.ACTIVE,
        description: 'this is a description',
      },
      testUserToken,
      testUserCreds
    );

    // Now call Get and Check response is what we created
    const getResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}`,
      'GET',
      testUserToken,
      testUserCreds
    );

    expect(getResponse.status).toEqual(200);
    const fetchedCase: DeaCase = await getResponse.data;
    Joi.assert(fetchedCase, caseResponseSchema);

    expect(fetchedCase).toEqual(createdCase);

    await deleteCase(deaApiUrl ?? fail(), fetchedCase.ulid ?? fail(), testUserToken, testUserCreds);
  }, 30000);

  it('should throw an error when the case is not found', async () => {
    const url = `${deaApiUrl}cases`;
    const caseId = '123bogus';
    const response = await callDeaAPIWithCreds(`${url}/${caseId}`, 'GET', testUserToken, testUserCreds);

    expect(response.status).toEqual(404);
  });
});
