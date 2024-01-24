/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  AbortMultipartUploadCommand,
  CreateMultipartUploadCommand,
  CreateMultipartUploadCommandInput,
  ListObjectsCommand,
  ListObjectsCommandInput,
  S3Client,
  UploadPartCommand,
  UploadPartCommandInput,
} from '@aws-sdk/client-s3';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { Credentials } from 'aws4-axios';
import { enc } from 'crypto-js';
import sha256 from 'crypto-js/sha256';
import { Oauth2Token } from '../../models/auth';
import { DeaCase } from '../../models/case';
import { CaseFileStatus } from '../../models/case-file-status';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  MINUTES_TO_MILLISECONDS,
  completeCaseFileUploadSuccess,
  createCaseSuccess,
  delay,
  deleteCase,
  deleteCaseFiles,
  describeCaseFileDetailsSuccess,
  downloadContentFromS3,
  getCaseFileDownloadUrl,
  initiateCaseFileUploadSuccess,
  listCaseFilesSuccess,
  randomSuffix,
  s3Cleanup,
  s3Object,
  s3ObjectHasLegalHold,
  uploadContentToS3,
} from './test-helpers';

const FILE_PATH = '/food/sushi/';
const FILE_CONTENT = 'hello world';
// for multipart test -> part size can be 5 MiB to 5 GiB. There is no minimum size limit on the last part of your multipart upload.
const LARGE_FILE_CONTENT = Buffer.alloc(6 * 1024 * 1024, 'a');
const TEST_USER = `caseFileUploadTestUser${randomSuffix()}`;
const FILE_SIZE_BYTES = 50;
const DEA_API_URL = testEnv.apiUrlOutput;

describe('Test case file APIs', () => {
  const cognitoHelper = new CognitoHelper();

  const caseIdsToDelete: string[] = [];
  const s3ObjectsToDelete: s3Object[] = [];

  jest.setTimeout(180_000); // 3 minute timeout

  let creds: Credentials;
  let idToken: Oauth2Token;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(TEST_USER, 'CaseWorker', 'CaseFile', 'Uploader');
    const credentials = await cognitoHelper.getCredentialsForUser(TEST_USER);
    creds = credentials[0];
    idToken = credentials[1];
  });

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(DEA_API_URL, caseId, idToken, creds);
    }

    await cognitoHelper.cleanup();

    await s3Cleanup(s3ObjectsToDelete);
  });

  it(
    'Upload a case file',
    async () => {
      const createdCase = await createCase(idToken, creds);
      const caseUlid = createdCase.ulid ?? fail();
      caseIdsToDelete.push(caseUlid);

      // verify list-case-files returns zero case-files
      let listCaseFilesResponse = await listCaseFilesSuccess(
        DEA_API_URL,
        idToken,
        creds,
        caseUlid,
        FILE_PATH
      );
      expect(listCaseFilesResponse.files.length).toEqual(0);
      expect(listCaseFilesResponse.next).toBeUndefined();

      // initiate upload
      const initiatedCaseFile = await initiateCaseFileUploadSuccess(
        DEA_API_URL,
        idToken,
        creds,
        caseUlid,
        'positiveTest',
        FILE_PATH,
        FILE_SIZE_BYTES
      );

      const initiatedCaseFile2 = await initiateCaseFileUploadSuccess(
        DEA_API_URL,
        idToken,
        creds,
        caseUlid,
        'colocatedPositiveTest',
        FILE_PATH,
        FILE_SIZE_BYTES
      );

      const fileUlid = initiatedCaseFile.ulid ?? fail();
      const fileUlid2 = initiatedCaseFile2.ulid ?? fail();
      const key1 = `${caseUlid}/${fileUlid}`;
      const file1Object = { key: key1, uploadId: initiatedCaseFile.uploadId };
      s3ObjectsToDelete.push(file1Object);
      const key2 = `${caseUlid}/${fileUlid2}`;
      const file2Object = { key: key2, uploadId: initiatedCaseFile2.uploadId };
      s3ObjectsToDelete.push(file2Object);
      const uploadId = initiatedCaseFile.uploadId ?? fail();
      const uploadId2 = initiatedCaseFile2.uploadId ?? fail();

      // verify list-case-files and describe-case-file match expected state after initiate-upload
      listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, FILE_PATH);
      expect(listCaseFilesResponse.files.length).toEqual(2);
      expect(listCaseFilesResponse.next).toBeUndefined();
      let describedCaseFile = await describeCaseFileDetailsSuccess(
        DEA_API_URL,
        idToken,
        creds,
        caseUlid,
        initiatedCaseFile.ulid
      );
      expect(describedCaseFile.status).toEqual(CaseFileStatus.PENDING);
      expect(
        listCaseFilesResponse.files.find((caseFile) => caseFile.fileName === describedCaseFile.fileName)
      ).toBeTruthy();

      await uploadContentToS3(
        initiatedCaseFile.federationCredentials,
        uploadId,
        [FILE_CONTENT],
        initiatedCaseFile.bucket,
        key1
      );
      await uploadContentToS3(
        initiatedCaseFile2.federationCredentials,
        uploadId2,
        [
          LARGE_FILE_CONTENT.subarray(0, LARGE_FILE_CONTENT.length - 100).toString(),
          LARGE_FILE_CONTENT.subarray(LARGE_FILE_CONTENT.length - 100).toString(),
        ],
        initiatedCaseFile2.bucket,
        key2
      );

      // complete upload
      await completeCaseFileUploadSuccess(DEA_API_URL, idToken, creds, caseUlid, fileUlid, uploadId);

      await completeCaseFileUploadSuccess(DEA_API_URL, idToken, creds, caseUlid, fileUlid2, uploadId2);

      // verify list-case-files and describe-case-file match expected state after complete-upload
      listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, '/');
      expect(listCaseFilesResponse.files.length).toEqual(1);
      expect(listCaseFilesResponse.files[0].fileName).toEqual('food');
      expect(listCaseFilesResponse.files[0].isFile).toEqual(false);
      listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, '/food/');
      expect(listCaseFilesResponse.files.length).toEqual(1);
      expect(listCaseFilesResponse.files[0].fileName).toEqual('sushi');
      expect(listCaseFilesResponse.files[0].isFile).toEqual(false);
      listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, FILE_PATH);
      expect(listCaseFilesResponse.files.length).toEqual(2);
      expect(listCaseFilesResponse.next).toBeUndefined();
      describedCaseFile = await describeCaseFileDetailsSuccess(
        DEA_API_URL,
        idToken,
        creds,
        caseUlid,
        fileUlid
      );

      // wait for the object to be processed for object lock and checksum
      await delay(2 * MINUTES_TO_MILLISECONDS);

      const describedCaseFile2 = await describeCaseFileDetailsSuccess(
        DEA_API_URL,
        idToken,
        creds,
        caseUlid,
        fileUlid2
      );
      expect(describedCaseFile.status).toEqual(CaseFileStatus.ACTIVE);
      expect(
        listCaseFilesResponse.files.find((caseFile) => caseFile.fileName === describedCaseFile.fileName)
      ).toBeTruthy();

      // Verify that the S3 Objects have Object Locks (Legal Hold) on them
      expect(s3ObjectHasLegalHold(file1Object)).toBeTruthy();
      expect(s3ObjectHasLegalHold(file2Object)).toBeTruthy();

      // verify download-case-file works as expected
      const downloadUrl = await getCaseFileDownloadUrl(DEA_API_URL, idToken, creds, caseUlid, fileUlid, "e2e test needs to download file");
      const downloadedContent = await downloadContentFromS3(downloadUrl, describedCaseFile.contentType);
      expect(downloadedContent).toEqual(FILE_CONTENT);
      expect(sha256(downloadedContent).toString(enc.Base64)).toEqual(describedCaseFile.sha256Hash);

      // verify the multipart-uploaded file
      const downloadUrl2 = await getCaseFileDownloadUrl(DEA_API_URL, idToken, creds, caseUlid, fileUlid2, "e2e test needs to download file");
      const downloadedContent2 = await downloadContentFromS3(downloadUrl2, describedCaseFile2.contentType);
      expect(downloadedContent2).toEqual(LARGE_FILE_CONTENT.toString());
      console.log(`checking hash ${new Date()}`);
      console.log(`response: ${describedCaseFile2.sha256Hash}`);
      expect(sha256(downloadedContent2).toString(enc.Base64)).toEqual(describedCaseFile2.sha256Hash);

      await deleteCaseFiles(DEA_API_URL, caseUlid, createdCase.name, FILE_PATH, idToken, creds);
    },
    10 * MINUTES_TO_MILLISECONDS
  );

  it('provides a restrictive temporary policy', async () => {
    const suffix = randomSuffix();
    const createdCase = await createCase(idToken, creds);
    const caseUlid = createdCase.ulid ?? fail();
    caseIdsToDelete.push(caseUlid);

    const initiatedCaseFile = await initiateCaseFileUploadSuccess(
      DEA_API_URL,
      idToken,
      creds,
      caseUlid,
      `fileone-${suffix}`,
      FILE_PATH,
      FILE_SIZE_BYTES
    );

    const initiatedCaseFile2 = await initiateCaseFileUploadSuccess(
      DEA_API_URL,
      idToken,
      creds,
      caseUlid,
      `filetwo-${suffix}`,
      FILE_PATH,
      FILE_SIZE_BYTES
    );

    const s3client = new S3Client({
      region: testEnv.awsRegion,
      credentials: initiatedCaseFile.federationCredentials,
    });

    const tempStsClient = new STSClient({
      region: testEnv.awsRegion,
      credentials: initiatedCaseFile.federationCredentials,
    });

    // can't create a new multipart upload
    const createMultipartUpload: CreateMultipartUploadCommandInput = {
      Bucket: initiatedCaseFile.bucket,
      Key: `${caseUlid}/boguskey`,
    };
    await expect(s3client.send(new CreateMultipartUploadCommand(createMultipartUpload))).rejects.toThrow(
      /is not authorized to perform/g
    );

    // can't upload for a different file
    const uploadPartCommand: UploadPartCommandInput = {
      Bucket: initiatedCaseFile2.bucket,
      Key: `${caseUlid}/${initiatedCaseFile2.ulid}`,
      UploadId: initiatedCaseFile2.uploadId,
      Body: FILE_CONTENT,
      PartNumber: 1,
    };
    await expect(s3client.send(new UploadPartCommand(uploadPartCommand))).rejects.toThrow('Access Denied');

    // can't list bucket contents
    const listObjectsCommand: ListObjectsCommandInput = {
      Bucket: initiatedCaseFile.bucket,
    };
    await expect(s3client.send(new ListObjectsCommand(listObjectsCommand))).rejects.toThrow('Access Denied');

    // can't make sts calls
    await expect(
      tempStsClient.send(
        new AssumeRoleCommand({ RoleArn: testEnv.DataSyncRole, RoleSessionName: 'temp-session' })
      )
    ).rejects.toThrow(/is not authorized to perform/g);

    // cleanup
    const admins3Client = new S3Client({ region: testEnv.awsRegion });
    await admins3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: initiatedCaseFile.bucket,
        Key: initiatedCaseFile.fileS3Key,
        UploadId: initiatedCaseFile.uploadId,
      })
    );
    await admins3Client.send(
      new AbortMultipartUploadCommand({
        Bucket: initiatedCaseFile2.bucket,
        Key: initiatedCaseFile2.fileS3Key,
        UploadId: initiatedCaseFile2.uploadId,
      })
    );
  });
});

async function createCase(idToken: Oauth2Token, creds: Credentials): Promise<DeaCase> {
  const caseName = `CASE with files_${randomSuffix()}`;
  return await createCaseSuccess(
    DEA_API_URL,
    {
      name: caseName,
      description: 'this is a description',
    },
    idToken,
    creds
  );
}
