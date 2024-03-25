/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { Oauth2Token } from '../../models/auth';
import { ScopedDeaCase } from '../../models/case';
import { scopedCaseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase, randomSuffix } from './test-helpers';

describe('get scoped case info E2E', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const caseWorker = `getScopedCaseInfoWorker${suffix}`;
  const evidenceManager = `getScopedCaseInfoManager${suffix}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let workerCreds: Credentials;
  let workerToken: Oauth2Token;
  let managerCreds: Credentials;
  let managerToken: Oauth2Token;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(caseWorker, 'CaseWorker', 'GetCase', 'TestUser');
    await cognitoHelper.createUser(evidenceManager, 'EvidenceManager', 'GetCase', 'TestUser');
    [workerCreds, workerToken] = await cognitoHelper.getCredentialsForUser(caseWorker);
    [managerCreds, managerToken] = await cognitoHelper.getCredentialsForUser(evidenceManager);
  });

  afterAll(async () => {
    await cognitoHelper.cleanup();
  });

  it('should get a created case', async () => {
    // Create Case
    const caseName = `caseyJones${suffix}`;
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        description: 'this is a description',
      },
      workerToken,
      workerCreds
    );

    // manager can see the case without membership
    const getResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/scoped-information`,
      'GET',
      managerToken,
      managerCreds
    );

    expect(getResponse.status).toEqual(200);
    const fetchedCase: ScopedDeaCase = await getResponse.data;
    Joi.assert(fetchedCase, scopedCaseResponseSchema);

    expect(fetchedCase.name).toEqual(createdCase.name);

    // case worker does not have access to the elevated endpoint
    const workerResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/scoped-information`,
      'GET',
      workerToken,
      workerCreds
    );

    expect(workerResponse.status).toEqual(403);

    await deleteCase(deaApiUrl ?? fail(), fetchedCase.ulid ?? fail(), workerToken, workerCreds);
  }, 30000);

  it('should throw an error when the case is not found', async () => {
    const url = `${deaApiUrl}cases`;
    const caseId = 'FAKEEFGHHJKKMNNPQRSTTVWXY9';
    const response = await callDeaAPIWithCreds(
      `${url}/${caseId}/scoped-information`,
      'GET',
      managerToken,
      managerCreds
    );

    expect(response.status).toEqual(404);
  });
});
