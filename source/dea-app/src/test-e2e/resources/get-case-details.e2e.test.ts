/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

describe('get case api', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'getCaseE2ETestUser';
  const deaApiUrl = envSettings.apiUrlOutput;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'GetCaseTestGroup', 'GetCase', 'TestUser');
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should get a created case', async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    // Create Case
    const caseName = 'caseWithDetails';
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

    // Now call Get and Check response is what we created
    const getResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}`,
      'GET',
      idToken,
      creds
    );

    expect(getResponse.status).toEqual(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fetchedCase = (await getResponse.data) as DeaCase;
    Joi.assert(fetchedCase, caseResponseSchema);

    expect(fetchedCase).toEqual(createdCase);

    await deleteCase(deaApiUrl ?? fail(), fetchedCase.ulid ?? fail(), idToken, creds);
  }, 20000);

  it('should throw an error when the case is not found', async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    const url = `${deaApiUrl}cases`;
    const caseId = '123bogus';
    const response = await callDeaAPIWithCreds(`${url}/${caseId}`, 'GET', idToken, creds);

    expect(response.status).toEqual(404);
  });
});
