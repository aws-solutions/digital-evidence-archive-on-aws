/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import sha256 from 'crypto-js/sha256';
import { AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import { CaseAction } from '../../models/case-action';
import { DeaCaseFile } from '../../models/case-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  completeCaseFileUploadSuccess,
  createCaseSuccess,
  delay,
  deleteCase,
  deleteCaseFiles,
  describeCaseFileDetailsSuccess,
  downloadContentFromS3,
  getCaseFileDownloadUrl,
  initiateCaseFileUploadSuccess,
  randomSuffix,
  uploadContentToS3,
  s3Cleanup,
  s3Object,
  inviteUserToCase,
  verifyAuditEntry,
  getAuditQueryResults,
  MINUTES_TO_MILLISECONDS,
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

  it(
    'retrieves actions taken against a case file',
    async () => {
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

      // Create a case user who DOES not have permission to download the file
      // and have them try to download, will show up in audit log as failure
      const failedDownloadTestUser = `caseFileAuditFailedDownloadTestUser${randomSuffix()}`;
      await inviteUserToCase(
        deaApiUrl,
        cognitoHelper,
        caseUlid,
        [CaseAction.VIEW_CASE_DETAILS],
        idToken,
        creds,
        failedDownloadTestUser,
        true
      );
      const [inviteeCreds, inviteeToken] = await cognitoHelper.getCredentialsForUser(failedDownloadTestUser);
      await expect(
        getCaseFileDownloadUrl(deaApiUrl, inviteeToken, inviteeCreds, caseUlid, fileUlid)
      ).rejects.toThrow();

      // wait for data plane events
      await delay(15 * MINUTES_TO_MILLISECONDS);

      const entries = await getAuditQueryResults(
        `${deaApiUrl}cases/${caseUlid}/files/${fileUlid}/audit`,
        '',
        idToken,
        creds,
        [
          AuditEventType.COMPLETE_CASE_FILE_UPLOAD,
          AuditEventType.GET_CASE_FILE_DETAIL,
          AuditEventType.DOWNLOAD_CASE_FILE,
        ],
        [
          { regex: /dynamodb.amazonaws.com/g, count: 6 },
          { regex: /s3.amazonaws.com/g, count: 7 },
        ]
      );

      const cloudtrailEntries = entries.filter((entry) => entry.Event_Type === 'AwsApiCall');
      const applicationEntries = entries.filter((entry) => entry.Event_Type !== 'AwsApiCall');

      // There should only be the following events for the CaseFileAudit:
      // InitiateCaseFileUpload
      // S3 CreateMultipartUpload
      // DB Query
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
      // S3 HeadObject
      // S3 GetObject
      // DownloadCaseFileUpload (By CaseUser Without Permissions)

      // Expect that the other created file does NOT show up in the entries
      expect(applicationEntries.find((entry) => entry.File_ID === otherFileUlid)).toBeUndefined();

      expect(applicationEntries).toHaveLength(5);

      // Now verify each of the event entries
      const initiateUploadEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.INITIATE_CASE_FILE_UPLOAD
      );
      if (!initiateUploadEntry) {
        fail('Initiate Upload Entry does not exist');
      }
      verifyAuditEntry(initiateUploadEntry, AuditEventType.INITIATE_CASE_FILE_UPLOAD, testUser, {
        expectedResult: 'success',
        expectedFileHash: '',
        expectedCaseUlid: caseUlid,
        expectedFileUlid: fileUlid,
      });

      const completeUploadEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.COMPLETE_CASE_FILE_UPLOAD
      );
      verifyAuditEntry(completeUploadEntry, AuditEventType.COMPLETE_CASE_FILE_UPLOAD, testUser, {
        expectedCaseUlid: caseUlid,
        expectedFileUlid: fileUlid,
        expectedResult: 'success',
        expectedFileHash: fileHash,
      });

      const getFileDetailsEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.GET_CASE_FILE_DETAIL
      );
      verifyAuditEntry(getFileDetailsEntry, AuditEventType.GET_CASE_FILE_DETAIL, testUser, {
        expectedCaseUlid: caseUlid,
        expectedFileUlid: fileUlid,
        expectedResult: 'success',
        expectedFileHash: '',
      });

      const downloadEntry = applicationEntries.find(
        (entry) => entry.Event_Type === AuditEventType.DOWNLOAD_CASE_FILE && entry.Username === testUser
      );
      verifyAuditEntry(downloadEntry, AuditEventType.DOWNLOAD_CASE_FILE, testUser, {
        expectedCaseUlid: caseUlid,
        expectedFileUlid: fileUlid,
        expectedResult: 'success',
        expectedFileHash: '',
      });

      const failedDownloadEntry = applicationEntries.find(
        (entry) =>
          entry.Event_Type === AuditEventType.DOWNLOAD_CASE_FILE && entry.Username === failedDownloadTestUser
      );
      verifyAuditEntry(failedDownloadEntry, AuditEventType.DOWNLOAD_CASE_FILE, failedDownloadTestUser, {
        expectedCaseUlid: caseUlid,
        expectedFileUlid: fileUlid,
        expectedResult: 'failure',
        expectedFileHash: '',
      });

      // Verify Cloudtrail audit trail events
      const dbGetItems = cloudtrailEntries.filter((entry) => entry.Request_Path === 'GetItem');
      expect(dbGetItems.length).toBeGreaterThanOrEqual(3);
      const dbTransactItems = cloudtrailEntries.filter(
        (entry) => entry.Request_Path === 'TransactWriteItems'
      );
      expect(dbTransactItems).toHaveLength(2);
      const createUploadItems = cloudtrailEntries.filter(
        (entry) => entry.Request_Path === 'CreateMultipartUpload'
      );
      expect(createUploadItems).toHaveLength(1);
      const uploadPartItems = cloudtrailEntries.filter((entry) => entry.Request_Path === 'UploadPart');
      expect(uploadPartItems).toHaveLength(1);
      const listPartItems = cloudtrailEntries.filter((entry) => entry.Request_Path === 'ListParts');
      expect(listPartItems).toHaveLength(1);
      const completeUploadItems = cloudtrailEntries.filter(
        (entry) => entry.Request_Path === 'CompleteMultipartUpload'
      );
      expect(completeUploadItems).toHaveLength(1);
      const objectLockItems = cloudtrailEntries.filter(
        (entry) => entry.Request_Path === 'PutObjectLockLegalHold'
      );
      expect(objectLockItems).toHaveLength(1);
      const getObjectItems = cloudtrailEntries.filter((entry) => entry.Request_Path === 'GetObject');
      expect(getObjectItems).toHaveLength(1);
      const headObjectItems = cloudtrailEntries.filter((entry) => entry.Request_Path === 'HeadObject');
      expect(headObjectItems).toHaveLength(1);
      const queryItems = cloudtrailEntries.filter((entry) => entry.Request_Path === 'Query');
      expect(queryItems).toHaveLength(1);

      expect(cloudtrailEntries.length).toBeGreaterThanOrEqual(13);

      // Case Cleanup
      await deleteCaseFiles(deaApiUrl, caseUlid, createdCase.name, FILE_PATH, idToken, creds);
    },
    45 * MINUTES_TO_MILLISECONDS
  );
});
