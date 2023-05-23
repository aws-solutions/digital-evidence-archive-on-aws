/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import { CaseAction } from '../../models/case-action';
import { joiUlid } from '../../models/validation/joi-common';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  callDeaAPIWithCreds,
  CaseAuditEventEntry,
  createCaseSuccess,
  delay,
  deleteCase,
  inviteUserToCase,
  parseCaseAuditCsv,
  parseTrailEventsFromAuditQuery,
  randomSuffix,
} from './test-helpers';

describe('case audit e2e', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix();
  const testUser = `caseAuditTestUser${suffix}`;
  const unauthorizedUser = `caseAuditTestUserUnauth${suffix}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;
  let managerCreds: Credentials;
  let managerToken: Oauth2Token;

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'CaseWorker', 'CaseAudit', 'TestUser');
    await cognitoHelper.createUser(unauthorizedUser, 'EvidenceManager', 'CaseAudit', 'UnauthorizedUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
    [managerCreds, managerToken] = await cognitoHelper.getCredentialsForUser(unauthorizedUser);
  }, 10000);

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, idToken, creds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  it('retrieves actions taken against a case', async () => {
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

    // Create a case user with certain permissions, and have them try
    // to do something outside the permissions, should show up as failure in the
    // audit log
    const failedCaseUser = `caseAuditFailedListFilesTestUser${suffix}`;
    await inviteUserToCase(
      deaApiUrl,
      cognitoHelper,
      caseUlid,
      [CaseAction.CASE_AUDIT],
      idToken,
      creds,
      failedCaseUser,
      true
    );
    const [inviteeCreds, inviteeToken] = await cognitoHelper.getCredentialsForUser(failedCaseUser);
    await callDeaAPIWithCreds(`${deaApiUrl}cases/${caseUlid}/files`, 'GET', inviteeToken, inviteeCreds);

    // allow some time so the events show up in CW logs
    await delay(5 * 60 * 1000);

    let csvData: string | undefined;
    let queryRetries = 5;
    while (!csvData && queryRetries > 0) {
      const startAuditQueryResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${caseUlid}/audit`,
        'POST',
        idToken,
        creds
      );

      expect(startAuditQueryResponse.status).toEqual(200);
      const auditId: string = startAuditQueryResponse.data.auditId;
      Joi.assert(auditId, joiUlid);

      let retries = 10;
      let getQueryReponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${caseUlid}/audit/${auditId}/csv`,
        'GET',
        idToken,
        creds
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
          `${deaApiUrl}cases/${caseUlid}/audit/${auditId}/csv`,
          'GET',
          idToken,
          creds
        );
      }

      const potentialCsvData: string = getQueryReponse.data;

      const dynamoMatch = potentialCsvData.match(/dynamodb.amazonaws.com/g);

      if (
        getQueryReponse.data &&
        !getQueryReponse.data.status &&
        potentialCsvData.includes(AuditEventType.UPDATE_CASE_DETAILS) &&
        potentialCsvData.includes(AuditEventType.GET_CASE_DETAILS) &&
        potentialCsvData.includes(AuditEventType.GET_USERS_FROM_CASE) &&
        dynamoMatch &&
        dynamoMatch.length >= 7
      ) {
        csvData = getQueryReponse.data;
      } else {
        await delay(10000);
      }
      --queryRetries;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const entries = parseCaseAuditCsv(csvData!).filter(
      (entry) =>
        entry.eventType != AuditEventType.GET_CASE_AUDIT &&
        entry.eventType != AuditEventType.REQUEST_CASE_AUDIT &&
        entry.eventDetails != 'StartQuery'
    );

    // 1. CreateCase
    // 2. TransactWriteItems
    // 3. UpdateCaseDetails
    // 4. DB Get
    // 5. TransactWriteItems
    // 6. DB Get
    // 7. GetCaseDetails
    // 8. DB Get
    // 9. GetUsersFromCase
    // 10. DB Get
    // 11. GetCaseDeatils (failure, unauthorized user)

    function verifyCaseAuditEntry(
      entry: CaseAuditEventEntry | undefined,
      expectedEventType: AuditEventType,
      expectedUsername: string,
      shouldSucceed = true
    ) {
      if (!entry) {
        fail('Entry does not exist');
      }
      expect(entry.eventType).toStrictEqual(expectedEventType);
      expect(entry.result).toStrictEqual(shouldSucceed);
      expect(entry.username).toStrictEqual(expectedUsername);
      expect(entry.caseId).toStrictEqual(caseUlid);
    }

    const createCaseEntry = entries.find((entry) => entry.eventType === AuditEventType.CREATE_CASE);
    verifyCaseAuditEntry(createCaseEntry, AuditEventType.CREATE_CASE, testUser);

    const updateCaseDetails = entries.find((entry) => entry.eventType === AuditEventType.UPDATE_CASE_DETAILS);
    verifyCaseAuditEntry(updateCaseDetails, AuditEventType.UPDATE_CASE_DETAILS, testUser);

    const getCaseDetailsEntry = entries.find((entry) => entry.eventType === AuditEventType.GET_CASE_DETAILS);
    verifyCaseAuditEntry(getCaseDetailsEntry, AuditEventType.GET_CASE_DETAILS, testUser);

    const getUsersFromCaseEntry = entries.find(
      (entry) => entry.eventType === AuditEventType.GET_USERS_FROM_CASE
    );
    verifyCaseAuditEntry(getUsersFromCaseEntry, AuditEventType.GET_USERS_FROM_CASE, testUser);

    const failedListCaseFilesEntry = entries.find(
      (entry) => entry.eventType === AuditEventType.GET_CASE_FILES && entry.username === failedCaseUser
    );
    verifyCaseAuditEntry(failedListCaseFilesEntry, AuditEventType.GET_CASE_FILES, failedCaseUser, false);

    const caseInviteEntry = entries.find((entry) => entry.eventType === AuditEventType.INVITE_USER_TO_CASE);
    verifyCaseAuditEntry(caseInviteEntry, AuditEventType.INVITE_USER_TO_CASE, testUser);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(caseInviteEntry!.targetUser).toStrictEqual(failedListCaseFilesEntry!.userUlid);

    expect(entries.length).toBe(6);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const cloudtrailEntries = parseTrailEventsFromAuditQuery(csvData!);

    const dbGetItems = cloudtrailEntries.filter((entry) => entry.eventType === 'GetItem');
    expect(dbGetItems.length).toBeGreaterThanOrEqual(5);
    const dbTransactItems = cloudtrailEntries.filter((entry) => entry.eventType === 'TransactWriteItems');
    expect(dbTransactItems).toHaveLength(2);

    expect(cloudtrailEntries.length).toBeGreaterThanOrEqual(7);
  }, 1800000);

  it('should prevent retrieval by an unauthorized user', async () => {
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

    //get an audit id with an authorized user (case membership)
    const startAuditQueryResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${caseUlid}/audit`,
      'POST',
      idToken,
      creds
    );

    expect(startAuditQueryResponse.status).toEqual(200);
    const auditId: string = startAuditQueryResponse.data.auditId;
    Joi.assert(auditId, joiUlid);

    // now use that audit id with an unauthorized user via a different csv endpoint that they have access to
    const getQueryReponse = await callDeaAPIWithCreds(
      `${deaApiUrl}system/audit/${auditId}/csv`,
      'GET',
      managerToken,
      managerCreds
    );

    expect(getQueryReponse.status).toEqual(404);
  });
});
