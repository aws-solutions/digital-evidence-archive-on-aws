/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

describe('get all cases api', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'getAllCasesTestUser';
  const deaApiUrl = envSettings.apiUrlOutput;

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'CreateCasesTestGroup', "GetAllCases", "TestUser");
  });

  afterAll(async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, idToken, creds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  it('should get all cases', async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    const caseNames = ['getAllCases-Case1', 'getAllCases-Case2', 'getAllCases-Case3', 'getAllCases-Case4'];
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
    createdCases.forEach((createdCase) => caseIdsToDelete.push(createdCase.ulid ?? fail()));

    const getResponse = await callDeaAPIWithCreds(`${deaApiUrl}cases/all-cases`, "GET", idToken, creds);

    expect(getResponse.status).toEqual(200);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fetchedCases = (await getResponse.data.cases) as DeaCase[];
    fetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseResponseSchema));
  }, 20000);
});
