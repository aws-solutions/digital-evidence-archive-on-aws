/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import { Oauth2Token } from '../../models/auth';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

describe('create cases api', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'createCaseTestUser';
  const deaApiUrl = testEnv.apiUrlOutput;

  const caseIdsToDelete: string[] = [];

  let creds: Credentials;
  let idToken: Oauth2Token;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'CreateCasesTestGroup', 'CreateCases', 'TestUser');
    const credentials = await cognitoHelper.getCredentialsForUser(testUser);
    creds = credentials[0];
    idToken = credentials[1];
  });

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, idToken, creds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  it('should create a new case', async () => {
    const caseName = 'CASE B';

    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        description: 'this is a description',
      },
      idToken,
      creds
    );

    caseIdsToDelete.push(createdCase.ulid ?? fail());
  }, 30000);

  it('should give an error when payload is missing', async () => {
    const response = await callDeaAPIWithCreds(`${deaApiUrl}cases`, 'POST', idToken, creds, undefined);

    expect(response.status).toEqual(400);
  });

  it('should give an error when the name is in use', async () => {
    const caseName = 'CASE C';
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        description: 'any description',
      },
      idToken,
      creds
    );

    caseIdsToDelete.push(createdCase.ulid ?? fail());

    const response = await callDeaAPIWithCreds(`${deaApiUrl}cases`, 'POST', idToken, creds, {
      name: caseName,
      status: 'ACTIVE',
      description: 'any description',
    });
    expect(response.status).toEqual(400);
    expect(response.data).toBe(`Case with name "${caseName}" is already in use`);
  }, 30000);
});
