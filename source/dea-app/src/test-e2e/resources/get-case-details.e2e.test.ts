/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { Oauth2Token } from '../../models/auth';
import { DeaCase } from '../../models/case';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase, randomSuffix } from './test-helpers';

describe('get case api', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testUser = `getCaseE2ETestUser${suffix}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let testUserCreds: Credentials;
  let testUserToken: Oauth2Token;

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
    const caseName = `caseWithDetails${suffix}`;
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        description: 'this is a description',
      },
      testUserToken,
      testUserCreds
    );

    // Now call Get and Check response is what we created
    const getResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/details`,
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
    const caseId = 'FAKEEFGHHJKKMNNPQRSTTVWXY9';
    const response = await callDeaAPIWithCreds(
      `${url}/${caseId}/details`,
      'GET',
      testUserToken,
      testUserCreds
    );

    expect(response.status).toEqual(404);
  });
});
