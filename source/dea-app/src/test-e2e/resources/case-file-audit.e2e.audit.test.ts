/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import sha256 from 'crypto-js/sha256';
import Joi from 'joi';
import { AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import { DeaCaseFile } from '../../models/case-file';
import { joiUlid } from '../../models/validation/joi-common';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  callDeaAPIWithCreds,
  completeCaseFileUploadSuccess,
  createCaseSuccess,
  delay,
  deleteCase,
  deleteCaseFiles,
  describeCaseFileDetailsSuccess,
  downloadContentFromS3,
  getCaseFileDownloadUrl,
  initiateCaseFileUploadSuccess,
  parseCaseFileAuditCsv,
  randomSuffix,
  uploadContentToS3,
  s3Cleanup,
  s3Object,
  CaseFileAuditEventEntry,
} from './test-helpers';

const FILE_PATH = '/important/investigation/';
const FILE_CONTENT = 'I like turtles';
const OTHER_FILE_CONTENT = 'I DO NOT like turtles';
const FILE_SIZE_MB = 1;

describe('case file audit e2e', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = `caseFileAuditTestUser${randomSuffix()}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  const caseIdsToDelete: string[] = [];
  const s3ObjectsToDelete: s3Object[] = [];

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'CaseWorker', 'CaseFileAudit', 'TestUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
  }, 10000);

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, idToken, creds);
    }
    await cognitoHelper.cleanup();

    await s3Cleanup(s3ObjectsToDelete);
  }, 30000);

  it('retrieves actions taken against a case file', async () => {
    const caseName = `auditFileTestCase${randomSuffix()}`;
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

    // Create file
    const initiatedCaseFile: DeaCaseFile = await initiateCaseFileUploadSuccess(
      deaApiUrl,
      idToken,
      creds,
      caseUlid,
      'caseFileAuditTest',
      FILE_PATH,
      FILE_SIZE_MB
    );
    const fileUlid = initiatedCaseFile.ulid ?? fail();
    s3ObjectsToDelete.push({ key: `${caseUlid}/${fileUlid}`, uploadId: initiatedCaseFile.uploadId });
    const uploadId = initiatedCaseFile.uploadId ?? fail();
    const presignedUrls = initiatedCaseFile.presignedUrls ?? fail();
    const fileHash = sha256(FILE_CONTENT).toString();
    await uploadContentToS3(presignedUrls, FILE_CONTENT);
    await completeCaseFileUploadSuccess(
      deaApiUrl,
      idToken,
      creds,
      caseUlid,
      fileUlid,
      uploadId,
      FILE_CONTENT
    );

    const describedCaseFile = await describeCaseFileDetailsSuccess(
      deaApiUrl,
      idToken,
      creds,
      caseUlid,
      fileUlid
    );

    // Owners by default have all permissions so have the owner download the file
    // will show up in audit log as success
    const downloadUrl = await getCaseFileDownloadUrl(deaApiUrl, idToken, creds, caseUlid, fileUlid);
    const downloadedContent = await downloadContentFromS3(downloadUrl, describedCaseFile.contentType);
    expect(downloadedContent).toEqual(FILE_CONTENT);
    expect(sha256(downloadedContent).toString()).toEqual(fileHash);
    expect(sha256(downloadedContent).toString()).toEqual(describedCaseFile.sha256Hash);

    // Create another file on the case, to later ensure it does not show up on the audit log
    const otherInitiatedCaseFile: DeaCaseFile = await initiateCaseFileUploadSuccess(
      deaApiUrl,
      idToken,
      creds,
      caseUlid,
      'caseFileAuditTestOtherFile',
      FILE_PATH,
      FILE_SIZE_MB
    );
    const otherFileUlid = otherInitiatedCaseFile.ulid ?? fail();
    s3ObjectsToDelete.push({
      key: `${caseUlid}/${otherFileUlid}`,
      uploadId: otherInitiatedCaseFile.uploadId,
    });
    const otherUploadId = otherInitiatedCaseFile.uploadId ?? fail();
    const otherPresignedUrls = otherInitiatedCaseFile.presignedUrls ?? fail();
    await uploadContentToS3(otherPresignedUrls, FILE_CONTENT);
    await completeCaseFileUploadSuccess(
      deaApiUrl,
      idToken,
      creds,
      caseUlid,
      otherFileUlid,
      otherUploadId,
      OTHER_FILE_CONTENT
    );

    // TODO: create a case user who DOES not have permission to download the file
    // and have them try to download, will show up in audit log as failure
    // Will do this next PR when I string AuditEventResult through the Audit Queries

    // allow some time so the events show up in CW logs
    await delay(25000);

    let csvData: string | undefined;
    const queryRetries = 5;
    while (!csvData && queryRetries > 0) {
      const startAuditQueryResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${caseUlid}/files/${fileUlid}/audit`,
        'POST',
        idToken,
        creds
      );

      expect(startAuditQueryResponse.status).toEqual(200);
      const auditId: string = startAuditQueryResponse.data.auditId;
      Joi.assert(auditId, joiUlid);

      let retries = 5;
      await delay(5000);
      let getQueryReponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${caseUlid}/files/${fileUlid}/audit/${auditId}/csv`,
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
          `${deaApiUrl}cases/${caseUlid}/files/${fileUlid}/audit/${auditId}/csv`,
          'GET',
          idToken,
          creds
        );
      }

      const potentialCsvData: string = getQueryReponse.data;

      if (
        getQueryReponse.data &&
        !getQueryReponse.data.status &&
        potentialCsvData.includes(AuditEventType.COMPLETE_CASE_FILE_UPLOAD) &&
        potentialCsvData.match(/dynamodb.amazonaws.com/g)?.length === 5 &&
        potentialCsvData.match(/s3.amazonaws.com/g)?.length === 6 &&
        potentialCsvData.includes(AuditEventType.GET_CASE_FILE_DETAIL) &&
        potentialCsvData.includes(AuditEventType.DOWNLOAD_CASE_FILE)
      ) {
        csvData = getQueryReponse.data;
      } else {
        await delay(10000);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const entries = parseCaseFileAuditCsv(csvData!).filter(
      (entry) =>
        entry.eventType != AuditEventType.GET_CASE_FILE_AUDIT &&
        entry.eventType != AuditEventType.REQUEST_CASE_FILE_AUDIT &&
        entry.eventDetails != 'StartQuery'
    );

    function verifyCaseFileAuditEntry(
      entry: CaseFileAuditEventEntry | undefined,
      expectedEventType: AuditEventType,
      expectedUsername: string,
      expectedFileHash?: string
    ) {
      if (!entry) {
        fail('Entry does not exist');
      }
      expect(entry.eventType).toStrictEqual(expectedEventType);
      expect(entry.username).toStrictEqual(expectedUsername);
      expect(entry.caseId).toStrictEqual(caseUlid);
      expect(entry.fileId).toStrictEqual(fileUlid);
      expect(entry.fileHash).toStrictEqual(expectedFileHash);
    }

    // There should only be the following events for the CaseFileAudit:
    // InitiateCaseFileUpload
    // S3 CreateMultipartUpload
    // DB TransactWriteItems
    // S3 UploadPart
    // CompleteCaseFileUpload
    // S3 ListParts
    // S3 CompleteMultipartUpload
    // S3 PutObjectLockLegalHold
    // DB TransactWriteItems
    // DB Get
    // GetCaseFileDetail (By Owner)
    // DB Get
    // DownloadCaseFileUpload (By Owner)
    // DB Get
    // GetObject
    // x. TODO: DownloadCaseFileUpload (By CaseUser Without Permissions) (When we add event result to audit queries)

    // Expect that the other created file does NOT show up in the entries
    expect(entries.find((entry) => entry.fileId === otherFileUlid)).toBeUndefined();

    expect(entries.length).toBe(15);

    const dbGetItems = entries.filter((entry) => entry.eventDetails === 'GetItem');
    expect(dbGetItems).toHaveLength(3);
    const dbTransactItems = entries.filter((entry) => entry.eventDetails === 'TransactWriteItems');
    expect(dbTransactItems).toHaveLength(2);
    const createUploadItems = entries.filter((entry) => entry.eventDetails === 'CreateMultipartUpload');
    expect(createUploadItems).toHaveLength(1);
    const uploadPartItems = entries.filter((entry) => entry.eventDetails === 'UploadPart');
    expect(uploadPartItems).toHaveLength(1);
    const listPartItems = entries.filter((entry) => entry.eventDetails === 'ListParts');
    expect(listPartItems).toHaveLength(1);
    const completeUploadItems = entries.filter((entry) => entry.eventDetails === 'CompleteMultipartUpload');
    expect(completeUploadItems).toHaveLength(1);
    const objectLockItems = entries.filter((entry) => entry.eventDetails === 'PutObjectLockLegalHold');
    expect(objectLockItems).toHaveLength(1);
    const getObjectItems = entries.filter((entry) => entry.eventDetails === 'GetObject');
    expect(getObjectItems).toHaveLength(1);

    // Now verify each of the event entries
    const initiateUploadEntry = entries.find(
      (entry) => entry.eventType === AuditEventType.INITIATE_CASE_FILE_UPLOAD
    );
    verifyCaseFileAuditEntry(initiateUploadEntry, AuditEventType.INITIATE_CASE_FILE_UPLOAD, testUser);

    const completeUploadEntry = entries.find(
      (entry) => entry.eventType === AuditEventType.COMPLETE_CASE_FILE_UPLOAD
    );
    verifyCaseFileAuditEntry(
      completeUploadEntry,
      AuditEventType.COMPLETE_CASE_FILE_UPLOAD,
      testUser,
      fileHash
    );

    const getFileDetailsEntry = entries.find(
      (entry) => entry.eventType === AuditEventType.GET_CASE_FILE_DETAIL
    );
    verifyCaseFileAuditEntry(getFileDetailsEntry, AuditEventType.GET_CASE_FILE_DETAIL, testUser);

    const downloadEntry = entries.find((entry) => entry.eventType === AuditEventType.DOWNLOAD_CASE_FILE);
    verifyCaseFileAuditEntry(downloadEntry, AuditEventType.DOWNLOAD_CASE_FILE, testUser);

    // Case Cleanup
    await deleteCaseFiles(deaApiUrl, caseUlid, createdCase.name, FILE_PATH, idToken, creds);
  }, 900000);
});
