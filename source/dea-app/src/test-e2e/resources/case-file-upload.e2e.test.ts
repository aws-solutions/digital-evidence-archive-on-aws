/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  DeleteObjectCommand,
  ObjectLockLegalHoldStatus,
  PutObjectLegalHoldCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Credentials } from 'aws4-axios';
import { DeaCase } from '../../models/case';
import { DeaCaseFile } from '../../models/case-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  completeCaseFileUploadSuccess,
  createCaseSuccess,
  deleteCase,
  initiateCaseFileUploadSuccess,
  s3Object,
  uploadContentToS3,
} from './test-helpers';

const FILE_PATH = '/food/sushi/';
const FILE_CONTENT = 'hello world';
const TEST_USER = 'caseFileUploadTestUser';
const FILE_SIZE_MB = 50;
const DEA_API_URL = testEnv.apiUrlOutput;
const s3Client = new S3Client({ region: testEnv.awsRegion });

describe('Test case file upload', () => {
  const cognitoHelper = new CognitoHelper();

  const caseIdsToDelete: string[] = [];
  const s3ObjectsToDelete: s3Object[] = [];

  jest.setTimeout(30000);

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(TEST_USER, 'CaseWorkerGroup', 'CaseFile', 'Uploader');
  });

  afterAll(async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(TEST_USER);

    for (const caseId of caseIdsToDelete) {
      await deleteCase(DEA_API_URL, caseId, idToken, creds);
    }

    await cognitoHelper.cleanup();

    for (const s3Object of s3ObjectsToDelete) {
      await s3Client.send(
        new PutObjectLegalHoldCommand({
          Bucket: testEnv.datasetsBucketName,
          Key: s3Object.key,
          LegalHold: { Status: ObjectLockLegalHoldStatus.OFF },
        })
      );
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: testEnv.datasetsBucketName,
          Key: s3Object.key,
        })
      );
    }
  });

  it('Upload a case file', async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(TEST_USER);

    const createdCase = await createCase(idToken, creds);
    const caseUlid = createdCase.ulid ?? fail();
    caseIdsToDelete.push(caseUlid);

    const initiatedCaseFile: DeaCaseFile = await initiateCaseFileUploadSuccess(
      DEA_API_URL,
      idToken,
      creds,
      caseUlid,
      'positiveTest',
      FILE_PATH,
      FILE_SIZE_MB
    );

    const presignedUrls = initiatedCaseFile.presignedUrls ?? fail();
    const fileUlid = initiatedCaseFile.ulid ?? fail();
    const uploadId = initiatedCaseFile.uploadId ?? fail();

    await uploadContentToS3(presignedUrls, FILE_CONTENT);

    await completeCaseFileUploadSuccess(
      DEA_API_URL,
      idToken,
      creds,
      caseUlid,
      fileUlid,
      uploadId,
      FILE_CONTENT
    );

    s3ObjectsToDelete.push({ key: `${caseUlid}/${fileUlid}` });

    // todo: add validation of uploaded file and sha256 hash when file download is implemented
  });
});

async function createCase(idToken: string, creds: Credentials): Promise<DeaCase> {
  const caseName = 'CASE with files';
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
