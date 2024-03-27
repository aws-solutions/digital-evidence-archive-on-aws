/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import { AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  AuditExpectations,
  callDeaAPIWithCreds,
  createCaseSuccess,
  deleteCase,
  getAuditQueryResults,
  getSpecificUserByFirstName,
  randomSuffix,
  verifyAuditEntry,
} from './test-helpers';

describe('user audit e2e', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testUser = `userAuditTestUser${suffix}`;
  const userRole = 'CaseWorker';
  const testManager = `userAuditTestManager${suffix}`;
  const managerRole = 'WorkingManager';
  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let workerIdToken: Oauth2Token;
  let userUlid: string;
  let managerCreds: Credentials;
  let managerIdToken: Oauth2Token;

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    // Create manager
    await cognitoHelper.createUser(testManager, managerRole, testManager, 'TestManager');
    [managerCreds, managerIdToken] = await cognitoHelper.getCredentialsForUser(testManager);

    // Create worker
    await cognitoHelper.createUser(testUser, userRole, testUser, 'TestUser');
    [creds, workerIdToken] = await cognitoHelper.getCredentialsForUser(testUser);

    // initialize the user into the DB
    await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', workerIdToken, creds);
    // get the user ulid
    userUlid = (await getSpecificUserByFirstName(deaApiUrl, testUser, managerIdToken, managerCreds)).ulid;
  }, 20000);

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, workerIdToken, creds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  it('retrieves actions taken by a user', async () => {
    const caseName = `auditTestCase${randomSuffix()}`;
    const managerCaseName = `managerAuditTestCase${randomSuffix()}`;
    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        description: 'this is a description',
      },
      workerIdToken,
      creds
    );
    const caseUlid = createdCase.ulid ?? fail();
    caseIdsToDelete.push(caseUlid);

    const managerCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: managerCaseName,
        description: 'this is a description',
      },
      managerIdToken,
      managerCreds
    );
    const managerCaseUlid = managerCase.ulid ?? fail();
    caseIdsToDelete.push(managerCaseUlid);

    const updateResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${caseUlid}/details`,
      'PUT',
      workerIdToken,
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
      workerIdToken,
      creds
    );
    expect(getResponse.status).toEqual(200);

    const getManagerCaseResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${managerCaseUlid}/details`,
      'GET',
      workerIdToken,
      creds
    );
    expect(getManagerCaseResponse.status).toEqual(404);

    const membershipsResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${caseUlid}/userMemberships`,
      'GET',
      workerIdToken,
      creds
    );
    expect(membershipsResponse.status).toEqual(200);

    // allow some time so the events show up in CW logs
    await delay(25000);

    const entries = await getAuditQueryResults(
      `${deaApiUrl}users/${userUlid}/audit`,
      '',
      managerIdToken,
      managerCreds,
      [
        AuditEventType.UPDATE_CASE_DETAILS,
        AuditEventType.GET_CASE_DETAILS,
        AuditEventType.GET_USERS_FROM_CASE,
        AuditEventType.GET_MY_CASES,
      ],
      []
    );

    // 0. GetMyCases
    const getMyCases = entries.find((entry) => entry.Event_Type === AuditEventType.GET_MY_CASES);
    // 1. CreateCase
    const createCaseEvent = entries.find((entry) => entry.Event_Type === AuditEventType.CREATE_CASE);
    // 2. Update Case Details
    const updateCaseDetails = entries.find(
      (entry) => entry.Event_Type === AuditEventType.UPDATE_CASE_DETAILS
    );
    // 3. Retrieve Case Details
    const getCaseDetails = entries.find(
      (entry) => entry.Event_Type === AuditEventType.GET_CASE_DETAILS && entry.Case_ID === createdCase.ulid
    );
    // 4. Get memberships
    const getCaseMemberships = entries.find(
      (entry) => entry.Event_Type === AuditEventType.GET_USERS_FROM_CASE
    );
    // 5. Get Case Details - failure
    const getCaseDetailsFailure = entries.find(
      (entry) => entry.Event_Type === AuditEventType.GET_CASE_DETAILS && entry.Case_ID === managerCase.ulid
    );

    const expectedDetails: AuditExpectations = {
      expectedResult: 'success',
      expectedFileHash: '',
      expectedCaseUlid: createdCase.ulid,
      expectedFileUlid: '',
      expectedDataVaultId: '',
    };
    verifyAuditEntry(getMyCases, AuditEventType.GET_MY_CASES, testUser, userRole);
    verifyAuditEntry(createCaseEvent, AuditEventType.CREATE_CASE, testUser, userRole, expectedDetails);
    verifyAuditEntry(
      updateCaseDetails,
      AuditEventType.UPDATE_CASE_DETAILS,
      testUser,
      userRole,
      expectedDetails
    );
    verifyAuditEntry(getCaseDetails, AuditEventType.GET_CASE_DETAILS, testUser, userRole, expectedDetails);
    verifyAuditEntry(
      getCaseMemberships,
      AuditEventType.GET_USERS_FROM_CASE,
      testUser,
      userRole,
      expectedDetails
    );
    verifyAuditEntry(getCaseDetailsFailure, AuditEventType.GET_CASE_DETAILS, testUser, userRole, {
      expectedResult: 'failure',
      expectedFileHash: '',
      expectedCaseUlid: managerCaseUlid,
      expectedFileUlid: '',
      expectedDataVaultId: '',
    });

    expect(entries).toHaveLength(6);
  }, 180000);

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
