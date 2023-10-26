/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  AthenaClient,
  GetQueryExecutionCommand,
  QueryExecutionState,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import { S3 } from '@aws-sdk/client-s3';
import { Credentials } from 'aws4-axios';
import { Oauth2Token } from '../../models/auth';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  MINUTES_TO_MILLISECONDS,
  createCaseSuccess,
  delay,
  deleteCase,
  randomSuffix,
  s3KeyHasLegalHold,
} from '../resources/test-helpers';

describe('the audit object legal hold process', () => {
  const terminalStates = [
    QueryExecutionState.CANCELLED.valueOf(),
    QueryExecutionState.FAILED.valueOf(),
    QueryExecutionState.SUCCEEDED.valueOf(),
    undefined,
  ];
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
    'applies legal hold to newly created audit s3 objects',
    async () => {
      const athenaClient = new AthenaClient({ region: testEnv.awsRegion });
      const s3Client = new S3({ region: testEnv.awsRegion });

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
      const queryString = `SELECT "$PATH" FROM "${testEnv.glueDBName}"."${testEnv.glueTableName}" where caseid='${caseUlid}';`;

      // wait for the audit object to be created
      await delay(2 * MINUTES_TO_MILLISECONDS);

      let auditObjParts: string[] | undefined = undefined;
      let retries = 10;
      while (retries > 0 && !auditObjParts) {
        const startAthenaQueryCmd = new StartQueryExecutionCommand({
          QueryString: queryString,
          WorkGroup: testEnv.athenaWorkgroupName,
        });
        const startResponse = await athenaClient.send(startAthenaQueryCmd);
        const queryId = startResponse.QueryExecutionId;
        if (!queryId) {
          fail('Unknown error starting Athena Query.');
        }

        const getExecCmd = new GetQueryExecutionCommand({
          QueryExecutionId: queryId,
        });
        let getResultsResponse = await athenaClient.send(getExecCmd);
        while (!terminalStates.includes(getResultsResponse.QueryExecution?.Status?.State)) {
          await delay(1000);
          getResultsResponse = await athenaClient.send(getExecCmd);
        }
        if (getResultsResponse.QueryExecution?.Status?.State !== QueryExecutionState.SUCCEEDED) {
          console.log(`Failure: ${JSON.stringify(getResultsResponse.QueryExecution?.Status)}`);
          fail('Failed to execute Athena query.');
        }
        const outputLocation = getResultsResponse.QueryExecution?.ResultConfiguration?.OutputLocation;
        if (!outputLocation) {
          fail('No output location found for audit query.');
        }

        const locationParts = outputLocation.split('/');
        const getObjectResponse = await s3Client.getObject({
          Bucket: locationParts[2],
          Key: locationParts.slice(3).join('/'),
        });
        const objstr = await getObjectResponse.Body?.transformToString();

        if (objstr?.includes('s3://')) {
          const auditObj = objstr?.substring(objstr.indexOf('s3://'), objstr.indexOf('.gz') + 3);
          if (!auditObj) {
            fail('No audit object found.');
          }
          auditObjParts = auditObj.split('/');
        } else {
          console.log('Empty results', { objstr: objstr });
        }

        --retries;
        await delay(1 * MINUTES_TO_MILLISECONDS);
      }

      if (!auditObjParts) {
        fail();
      }

      const hasLegalHold = await s3KeyHasLegalHold(auditObjParts[2], auditObjParts.slice(3).join('/'));
      expect(hasLegalHold).toBe(true);
    },
    15 * MINUTES_TO_MILLISECONDS
  );
});
