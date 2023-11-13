/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import { CaseAction } from '../../models/case-action';
import { joiUlid } from '../../models/validation/joi-common';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  AuditExpectations,
  MINUTES_TO_MILLISECONDS,
  callDeaAPIWithCreds,
  createCaseSuccess,
  delay,
  deleteCase,
  getAuditQueryResults,
  inviteUserToCase,
  randomSuffix,
  verifyAuditEntry,
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
    await cognitoHelper.createUser(
      unauthorizedUser,
      'EvidenceManager',
      'CaseAuditManager',
      'UnauthorizedUser'
    );
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
    [managerCreds, managerToken] = await cognitoHelper.getCredentialsForUser(unauthorizedUser);
  }, 10000);

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
    'retrieves actions taken against a case',
    async () => {
      const caseName = `auditTestCase${randomSuffix()}`;

      const startTime = currentSeconds();
      // ensure separation between the start time and when events roll in
      await delay(1000);

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
      const firstInvitePermissions = [CaseAction.CASE_AUDIT];
      // Invite user
      const inviteeUlid = await inviteUserToCase(
        deaApiUrl,
        cognitoHelper,
        caseUlid,
        firstInvitePermissions,
        idToken,
        creds,
        failedCaseUser,
        true
      );

      // Modify User Permissions
      const modifyInvitePermissions = [
        CaseAction.VIEW_CASE_DETAILS,
        CaseAction.CASE_AUDIT,
        CaseAction.UPLOAD,
      ];
      const modifyResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${caseUlid}/users/${inviteeUlid}/memberships`,
        'PUT',
        idToken,
        creds,
        {
          userUlid: inviteeUlid,
          caseUlid: caseUlid,
          actions: modifyInvitePermissions,
        }
      );
      expect(modifyResponse.status).toEqual(200);

      // Remove User Permissions
      await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${caseUlid}/users/${inviteeUlid}/memberships`,
        'DELETE',
        idToken,
        creds,
        {
          userUlid: inviteeUlid,
          caseUlid: caseUlid,
        }
      );

      // Try to call a case API see that it fails.
      // The three case-invite APIs should show up in the case Audit with the actions taken
      const [inviteeCreds, inviteeToken] = await cognitoHelper.getCredentialsForUser(failedCaseUser);
      await callDeaAPIWithCreds(`${deaApiUrl}cases/${caseUlid}/files`, 'GET', inviteeToken, inviteeCreds);

      // Add another user as an owner, see that the targetUserId is populated in the audit log
      const createCaseOwnerResp = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${caseUlid}/owner`,
        'POST',
        managerToken,
        managerCreds,
        {
          userUlid: inviteeUlid,
          caseUlid: caseUlid,
        }
      );
      expect(createCaseOwnerResp.status).toEqual(200);
      // add some buffer to the end time
      const endTime = currentSeconds() + 2;

      //wait a moment so the next event falls outside of our end time
      await delay(3_000);
      // this event will not show up in the audit due to occurring after our specified endtime
      const outOfScopeEventResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${caseUlid}/details`,
        'GET',
        idToken,
        creds
      );
      expect(outOfScopeEventResponse.status).toEqual(200);

      // wait for data plane events
      await delay(15 * MINUTES_TO_MILLISECONDS);

      const entries = await getAuditQueryResults(
        `${deaApiUrl}cases/${caseUlid}/audit`,
        '',
        idToken,
        creds,
        [
          AuditEventType.CREATE_CASE,
          AuditEventType.UPDATE_CASE_DETAILS,
          AuditEventType.GET_CASE_DETAILS,
          AuditEventType.GET_USERS_FROM_CASE,
          AuditEventType.GET_CASE_FILES,
          AuditEventType.INVITE_USER_TO_CASE,
          AuditEventType.REMOVE_USER_FROM_CASE,
          AuditEventType.MODIFY_USER_PERMISSIONS_ON_CASE,
          AuditEventType.CREATE_CASE_OWNER,
        ],
        [
          { regex: /dynamodb.amazonaws.com/g, count: 8 },
          { regex: /TransactWriteItems/g, count: 2 },
          { regex: /GetItem/g, count: 6 },
        ],
        45000,
        {
          from: startTime,
          to: endTime,
        }
      );

      const cloudtrailEntries = entries.filter((entry) => entry.Event_Type === 'AwsApiCall');
      const applicationEntries = entries.filter((entry) => entry.Event_Type !== 'AwsApiCall');

      // CreateCase
      // DB - TransactWriteItems

      // UpdateCaseDetails
      // DB - GetItem
      // DB - TransactWriteItems
      // DB - GetItem

      // GetCaseDetails
      // DB - GetItem

      // GetUsersFromCase
      // DB - GetItem
      // DB - Query

      // InviteUserToCase
      // DB - GetItem

      // ModifyUserCasePermissions

      // RemoveUserFromCase

      // GetCaseFiles - failure

      // CreateCaseOwner

      const expectedSuccessDetails: AuditExpectations = {
        expectedCaseUlid: caseUlid,
        expectedFileHash: '',
        expectedFileUlid: '',
        expectedResult: 'success',
        expectedDataVaultId: '',
      };
      const createCaseEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.CREATE_CASE
      );
      verifyAuditEntry(createCaseEntry, AuditEventType.CREATE_CASE, testUser, expectedSuccessDetails);

      const updateCaseDetails = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.UPDATE_CASE_DETAILS
      );
      verifyAuditEntry(
        updateCaseDetails,
        AuditEventType.UPDATE_CASE_DETAILS,
        testUser,
        expectedSuccessDetails
      );

      const getCaseDetailsEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.GET_CASE_DETAILS
      );
      verifyAuditEntry(
        getCaseDetailsEntry,
        AuditEventType.GET_CASE_DETAILS,
        testUser,
        expectedSuccessDetails
      );

      const getUsersFromCaseEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.GET_USERS_FROM_CASE
      );
      verifyAuditEntry(
        getUsersFromCaseEntry,
        AuditEventType.GET_USERS_FROM_CASE,
        testUser,
        expectedSuccessDetails
      );

      const failedListCaseFilesEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.GET_CASE_FILES && entry.Username === failedCaseUser
      );
      if (!failedListCaseFilesEntry) {
        fail();
      }
      verifyAuditEntry(failedListCaseFilesEntry, AuditEventType.GET_CASE_FILES, failedCaseUser, {
        expectedResult: 'failure',
        expectedFileHash: '',
        expectedFileUlid: '',
        expectedCaseUlid: caseUlid,
        expectedDataVaultId: '',
      });

      const caseInviteEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.INVITE_USER_TO_CASE
      );
      if (!caseInviteEntry) {
        fail();
      }
      verifyAuditEntry(caseInviteEntry, AuditEventType.INVITE_USER_TO_CASE, testUser, expectedSuccessDetails);

      expect(caseInviteEntry.Target_User_ID).toStrictEqual(failedListCaseFilesEntry.DEA_User_ID);
      expect(caseInviteEntry.Case_Actions).toStrictEqual(firstInvitePermissions.join(':'));

      const modifyInviteEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.MODIFY_USER_PERMISSIONS_ON_CASE
      );
      if (!modifyInviteEntry) {
        fail();
      }

      verifyAuditEntry(
        modifyInviteEntry,
        AuditEventType.MODIFY_USER_PERMISSIONS_ON_CASE,
        testUser,
        expectedSuccessDetails
      );
      expect(modifyInviteEntry.Target_User_ID).toStrictEqual(failedListCaseFilesEntry.DEA_User_ID);
      expect(modifyInviteEntry.Case_Actions).toStrictEqual(modifyInvitePermissions.join(':'));

      const removeInviteEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.REMOVE_USER_FROM_CASE
      );
      if (!removeInviteEntry) {
        fail();
      }

      verifyAuditEntry(
        removeInviteEntry,
        AuditEventType.REMOVE_USER_FROM_CASE,
        testUser,
        expectedSuccessDetails
      );
      expect(removeInviteEntry.Target_User_ID).toStrictEqual(failedListCaseFilesEntry.DEA_User_ID);

      const createCaseOwnerEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.CREATE_CASE_OWNER
      );
      if (!createCaseOwnerEntry) {
        fail();
      }

      verifyAuditEntry(
        createCaseOwnerEntry,
        AuditEventType.CREATE_CASE_OWNER,
        unauthorizedUser,
        expectedSuccessDetails
      );
      expect(createCaseOwnerEntry.Target_User_ID).toStrictEqual(failedListCaseFilesEntry.DEA_User_ID);

      expect(applicationEntries.length).toBe(9);

      // We use toBeGreaterThanOrEqual on some dynamo events because we may have some additional entries coming in from the Audit query requests
      const dbGetItems = cloudtrailEntries.filter((entry) => entry.Request_Path === 'GetItem');
      expect(dbGetItems.length).toBeGreaterThanOrEqual(6);
      const dbTransactItems = cloudtrailEntries.filter(
        (entry) => entry.Request_Path === 'TransactWriteItems'
      );
      expect(dbTransactItems).toHaveLength(2);
      const dbQueryItems = cloudtrailEntries.filter((entry) => entry.Request_Path === 'Query');
      expect(dbQueryItems).toHaveLength(1);

      expect(cloudtrailEntries.length).toBeGreaterThanOrEqual(9);

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
