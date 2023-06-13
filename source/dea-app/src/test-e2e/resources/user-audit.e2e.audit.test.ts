/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import { joiUlid } from '../../models/validation/joi-common';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  callDeaAPIWithCreds,
  createCaseSuccess,
  getSpecificUserByFirstName,
  randomSuffix,
} from './test-helpers';

describe('user audit e2e', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testUser = `userAuditTestUser${suffix}`;
  const testManager = `userAuditTestManager${suffix}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;
  let userUlid: string;
  let managerCreds: Credentials;
  let managerIdToken: Oauth2Token;

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    // Create manager
    await cognitoHelper.createUser(testManager, 'WorkingManager', testManager, 'TestManager');
    [managerCreds, managerIdToken] = await cognitoHelper.getCredentialsForUser(testManager);

    // Create worker
    await cognitoHelper.createUser(testUser, 'CaseWorker', testUser, 'TestUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    // initialize the user into the DB
    await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken, creds);
    // get the user ulid
    userUlid = (await getSpecificUserByFirstName(deaApiUrl, testUser, managerIdToken, managerCreds)).ulid;
  }, 20000);

  afterAll(async () => {
    await cognitoHelper.cleanup();
  }, 30000);

  it('retrieves actions taken against a user', async () => {
    const caseName = `auditTestCase${randomSuffix()}`;
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        description: 'this is a description',
      },
      idToken,
      creds
    );
    const caseUlid = createdCase.ulid ?? fail();
    caseIdsToDelete.push(caseUlid);

    const updateResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${caseUlid}/details`,
      'PUT',
      idToken,
      creds,
      {
        ulid: caseUlid,
        name: caseName,
        description: 'An updated description',
      }
    );
    expect(updateResponse.status).toEqual(200);

    const getResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${caseUlid}/details`,
      'GET',
      idToken,
      creds
    );
    expect(getResponse.status).toEqual(200);

    const membershipsResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${caseUlid}/userMemberships`,
      'GET',
      idToken,
      creds
    );
    expect(membershipsResponse.status).toEqual(200);

    // allow some time so the events show up in CW logs
    await delay(25000);

    let csvData: string | undefined;
    let queryRetries = 50;
    while (!csvData && queryRetries > 0) {
      const startAuditQueryResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}users/${userUlid}/audit`,
        'POST',
        managerIdToken,
        managerCreds
      );

      expect(startAuditQueryResponse.status).toEqual(200);
      const auditId: string = startAuditQueryResponse.data.auditId;
      Joi.assert(auditId, joiUlid);

      let retries = 5;
      let getQueryReponse = await callDeaAPIWithCreds(
        `${deaApiUrl}users/${userUlid}/audit/${auditId}/csv`,
        'GET',
        managerIdToken,
        managerCreds
      );
      while (getQueryReponse.data.status && retries > 0) {
        if (getQueryReponse.data.status === 'Complete') {
          break;
        }
        --retries;
        if (getQueryReponse.status !== 200) {
          fail();
        }
        await delay(2000);

        getQueryReponse = await callDeaAPIWithCreds(
          `${deaApiUrl}users/${userUlid}/audit/${auditId}/csv`,
          'GET',
          managerIdToken,
          managerCreds
        );
      }

      const potentialCsvData: string = getQueryReponse.data;

      if (
        getQueryReponse.data &&
        !getQueryReponse.data.status &&
        potentialCsvData.includes(AuditEventType.UPDATE_CASE_DETAILS) &&
        potentialCsvData.includes(AuditEventType.GET_CASE_DETAILS) &&
        potentialCsvData.includes(AuditEventType.GET_USERS_FROM_CASE)
      ) {
        csvData = getQueryReponse.data;
      }
      --queryRetries;
    }

    expect(csvData).toContain('/cases/{caseId}/details');
    expect(csvData).toContain(testUser);
    expect(csvData).toContain(caseUlid);
    expect(csvData).toContain(AuditEventType.GET_CASE_DETAILS);
    expect(csvData).toContain(AuditEventType.UPDATE_CASE_DETAILS);
    expect(csvData).toContain(AuditEventType.GET_USERS_FROM_CASE);
  }, 180000);

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
