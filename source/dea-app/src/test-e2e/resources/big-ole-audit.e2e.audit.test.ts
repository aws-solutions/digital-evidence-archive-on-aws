/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import { AxiosResponse } from 'axios';
import { AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  MINUTES_TO_MILLISECONDS,
  callDeaAPIWithCreds,
  createCaseSuccess,
  delay,
  deleteCase,
  getAuditQueryResults,
  randomSuffix,
} from './test-helpers';

describe('case audit e2e', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix();
  const testUser = `caseAuditTestUser${suffix}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  const caseIdsToDelete: string[] = [];

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'CaseWorker', 'CaseAudit', 'TestUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
  }, 10000);

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, idToken, creds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  it(
    'retrieves actions taken against a case',
    async () => {
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

      const recursions = 100;
      const repetitions = 13;
      for (let i = 0; i < recursions; ++i) {
        const promises: Promise<AxiosResponse>[] = [];
        for (let j = 0; j < repetitions; ++j) {
          // getcasedetail + getitem
          promises.push(addGetCaseDetailsCall(caseUlid));
          // getmemberships + getitem + query
          promises.push(addGetMembershipsCall(caseUlid));
          // getfiles + getitem + query
          promises.push(addGetFilesCall(caseUlid));
        }
        // one update per group to prevent transaction conflicts
        promises.push(addCaseUpdateCall(caseUlid, caseName, i));
        // caseupdate + getitem + transact + getitem

        const responses = await Promise.all(promises);
        const failures = responses.filter((r) => r.status !== 200);
        failures.forEach((failure) => {
          console.log(failure.data);
          console.log(failure.status);
          console.log(failure.statusText);
          console.log(failure.request?.path);
        });
        expect(failures).toHaveLength(0);
        await delay(1000);
      }

      // wait for data plane events
      await delay(15 * MINUTES_TO_MILLISECONDS);
      // refresh credentials
      [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

      const transactCount =
        // 1 for create
        1 +
        // 1 for each update * recursions
        recursions;

      const getItemCount =
        // 2 for each update * recursions
        2 * recursions +
        // 1 for get case details * repetitions * recursions
        1 * repetitions * recursions +
        // 1 for get case users * repetitions * recursions
        1 * repetitions * recursions +
        // 1 for get files * repititions * recursions
        1 * repetitions * recursions;

      const queryCount =
        // 1 for each list files * repetitions * recursions
        1 * repetitions * recursions +
        // 1 for each list users * repetitions * recursions
        1 * repetitions * recursions;

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
        ],
        [
          { regex: /GetItem/g, count: getItemCount },
          { regex: /Query/g, count: queryCount },
          { regex: /TransactWriteItems/g, count: transactCount },
        ],
        1 * MINUTES_TO_MILLISECONDS /* delay between attempts */
      );

      const cloudtrailEntries = entries.filter((entry) => entry.Event_Type === 'AwsApiCall');
      const applicationEntries = entries.filter((entry) => entry.Event_Type !== 'AwsApiCall');

      const createCaseEvents = applicationEntries.filter(
        (entry) => entry.Event_Type === AuditEventType.CREATE_CASE
      );
      const updateCaseEvents = applicationEntries.filter(
        (entry) => entry.Event_Type === AuditEventType.UPDATE_CASE_DETAILS
      );
      const getCaseDetailsEvents = applicationEntries.filter(
        (entry) => entry.Event_Type === AuditEventType.GET_CASE_DETAILS
      );
      const getCaseUsersEvents = applicationEntries.filter(
        (entry) => entry.Event_Type === AuditEventType.GET_USERS_FROM_CASE
      );
      const getCaseFilesEvents = applicationEntries.filter(
        (entry) => entry.Event_Type === AuditEventType.GET_CASE_FILES
      );

      expect(createCaseEvents).toHaveLength(1);
      expect(updateCaseEvents).toHaveLength(recursions);
      expect(getCaseDetailsEvents).toHaveLength(recursions * repetitions);
      expect(getCaseUsersEvents).toHaveLength(recursions * repetitions);
      expect(getCaseFilesEvents).toHaveLength(recursions * repetitions);
      expect(cloudtrailEntries.length).toBeGreaterThanOrEqual(transactCount + getItemCount + queryCount);
    },
    60 * MINUTES_TO_MILLISECONDS /* test timeout */
  );

  function addCaseUpdateCall(caseUlid: string, caseName: string, index: number) {
    return callDeaAPIWithCreds(`${deaApiUrl}cases/${caseUlid}/details`, 'PUT', idToken, creds, {
      ulid: caseUlid,
      name: caseName,
      description: `update ${index}`,
    });
  }

  function addGetCaseDetailsCall(caseUlid: string) {
    return callDeaAPIWithCreds(`${deaApiUrl}cases/${caseUlid}/details`, 'GET', idToken, creds);
  }

  function addGetMembershipsCall(caseUlid: string) {
    return callDeaAPIWithCreds(`${deaApiUrl}cases/${caseUlid}/user-memberships`, 'GET', idToken, creds);
  }

  function addGetFilesCall(caseUlid: string) {
    return callDeaAPIWithCreds(`${deaApiUrl}cases/${caseUlid}/files`, 'GET', idToken, creds);
  }
});
