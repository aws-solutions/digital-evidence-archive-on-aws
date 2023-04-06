/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { Oauth2Token } from '../../models/auth';
import { DeaCase } from '../../models/case';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

describe('get all cases api', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'getAllCasesTestUser';
  const deaApiUrl = testEnv.apiUrlOutput;

  const caseIdsToDelete: string[] = [];

  let creds: Credentials;
  let idToken: Oauth2Token;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'CreateCasesTestGroup', 'GetAllCases', 'TestUser');
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

  it('should get all cases', async () => {
    const caseNames = ['getAllCases-Case1', 'getAllCases-Case2', 'getAllCases-Case3', 'getAllCases-Case4'];
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
    createdCases.forEach((createdCase) => caseIdsToDelete.push(createdCase.ulid ?? fail()));

    const getResponse = await callDeaAPIWithCreds(`${deaApiUrl}cases/all-cases`, 'GET', idToken, creds);

    expect(getResponse.status).toEqual(200);
    const fetchedCases: DeaCase[] = await getResponse.data.cases;
    fetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseResponseSchema));
  }, 20000);
});
