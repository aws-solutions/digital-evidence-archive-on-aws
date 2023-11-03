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
  MINUTES_TO_MILLISECONDS,
  callDeaAPIWithCreds,
  createCaseSuccess,
  deleteCase,
  getAuditQueryResults,
  randomSuffix,
  verifyAuditEntry,
} from './test-helpers';

describe('system audit e2e', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testUser = `systemAuditTestUser${suffix}`;
  const testManager = `systemAuditTestManager${suffix}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;
  let managerCreds: Credentials;
  let managerIdToken: Oauth2Token;

  const caseIdsToDelete: string[] = [];

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, idToken, creds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  const currentSeconds = () => {
    return Math.trunc(Date.now() / 1000);
  };

  it(
    'retrieves system actions',
    async () => {
      const startTime = currentSeconds();
      // ensure separation between the start time and when events roll in
      await delay(1000);
      // Create manager
      await cognitoHelper.createUser(testManager, 'WorkingManager', testManager, 'TestManager');
      [managerCreds, managerIdToken] = await cognitoHelper.getCredentialsForUser(testManager);

      // Create worker
      await cognitoHelper.createUser(testUser, 'CaseWorker', testUser, 'TestUser');
      [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

      // initialize the user into the DB
      await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken, creds);

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
      // some buffer on the endtime
      const endTime = currentSeconds() + 2;

      // wait for data plane events
      await delay(15 * MINUTES_TO_MILLISECONDS);

      const entries = await getAuditQueryResults(
        `${deaApiUrl}system/audit`,
        `?from=${startTime}&to=${endTime}`,
        managerIdToken,
        managerCreds,
        [
          AuditEventType.CREATE_CASE,
          AuditEventType.UPDATE_CASE_DETAILS,
          AuditEventType.GET_CASE_DETAILS,
          AuditEventType.GET_USERS_FROM_CASE,
        ],
        [
          { regex: /dynamodb.amazonaws.com/g, count: 7 },
          { regex: /TransactWriteItems/g, count: 2 },
          { regex: /GetItem/g, count: 4 },
          { regex: /APIGateway/g, count: 1 },
          { regex: /cognito-idp.amazonaws.com/g, count: 1 },
          { regex: /kms.amazonaws.com/g, count: 1 },
          { regex: /ssm.amazonaws.com/g, count: 1 },
          { regex: /logs.amazonaws.com/g, count: 1 },
        ]
      );

      // CreateCase
      // Dynamo - TransactWriteItems
      // UpdateCaseDetails
      // Dynamo - GetItem
      // Dynamo - TransactWriteItems
      // Dynamo - GetItem

      // GetCaseDetails
      // Dynamo - GetItem

      // GetUsersFromCase
      // Dynamo - GetItem
      // Dynamo - Query
      const applicationEntries = entries.filter((entry) => entry.Event_Type !== 'AwsApiCall');

      const expectedDetails: AuditExpectations = {
        expectedResult: 'success',
        expectedCaseUlid: createdCase.ulid,
        expectedFileHash: '',
        expectedFileUlid: '',
        expectedDataVaultId: '',
      };
      const createCaseEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.CREATE_CASE && entry.Username === testUser
      );
      verifyAuditEntry(createCaseEntry, AuditEventType.CREATE_CASE, testUser, expectedDetails);

      const updateCaseDetails = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.UPDATE_CASE_DETAILS && entry.Username === testUser
      );
      verifyAuditEntry(updateCaseDetails, AuditEventType.UPDATE_CASE_DETAILS, testUser, expectedDetails);

      const getCaseDetailsEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.GET_CASE_DETAILS && entry.Username === testUser
      );
      verifyAuditEntry(getCaseDetailsEntry, AuditEventType.GET_CASE_DETAILS, testUser, expectedDetails);

      const getUsersFromCaseEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.GET_USERS_FROM_CASE && entry.Username === testUser
      );
      verifyAuditEntry(getUsersFromCaseEntry, AuditEventType.GET_USERS_FROM_CASE, testUser, expectedDetails);

      const beforeStartTimeEntry = entries.find(
        (entry) => Math.trunc(Date.parse(entry.DateTimeUTC) / 1000) < startTime
      );
      expect(beforeStartTimeEntry).toBeUndefined();
      const afterEndTimeEntry = entries.find(
        (entry) => Math.trunc(Date.parse(entry.DateTimeUTC) / 1000) > endTime
      );
      expect(afterEndTimeEntry).toBeUndefined();
      const withinStartAndEndEntry = entries.find(
        (entry) =>
          Math.trunc(Date.parse(entry.DateTimeUTC) / 1000) >= startTime &&
          Math.trunc(Date.parse(entry.DateTimeUTC) / 1000) <= endTime
      );
      expect(withinStartAndEndEntry).toBeDefined();
    },
    45 * MINUTES_TO_MILLISECONDS
  );

  function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
