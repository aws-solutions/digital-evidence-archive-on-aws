/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  S3Client,
  DeleteObjectCommand,
  PutObjectLegalHoldCommand,
  ObjectLockLegalHoldStatus,
} from '@aws-sdk/client-s3';
import { Credentials } from 'aws4-axios';
import axios from 'axios';
import sha256 from 'crypto-js/sha256';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { DeaCaseFile } from '../../models/case-file';
import { CaseStatus } from '../../models/case-status';
import { caseFileResponseSchema } from '../../models/validation/case-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase, validateStatus } from './test-helpers';

const CONTENT_TYPE = 'application/octet-stream';
const FILE_NAME = 'fileName';
const FILE_PATH = '/food/sushi/';
const FILE_CONTENT = 'hello world';
const TEST_USER = 'caseFileUploadTestUser';
const FILE_SIZE_MB = 50;
const DEA_API_URL = testEnv.apiUrlOutput;
const s3Client = new S3Client({ region: testEnv.awsRegion });

interface s3Object {
  key: string;
}

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

    const initiatedCaseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate(idToken, creds, caseUlid);
    const presignedUrls = initiatedCaseFile.presignedUrls ?? [];
    const fileUlid = initiatedCaseFile.ulid ?? fail();

    const presignedUploadResponses = uploadFile(presignedUrls);

    await Promise.all(presignedUploadResponses).then((responses) => {
      responses.forEach((response) => {
        expect(response.status).toEqual(200);
      });
    });

    await completeCaseFileUploadAndValidate(idToken, creds, createdCase, initiatedCaseFile);
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
      status: CaseStatus.ACTIVE,
      description: 'this is a description',
    },
    idToken,
    creds
  );
}

async function initiateCaseFileUploadAndValidate(
  idToken: string,
  creds: Credentials,
  caseUlid: string,
  fileName: string = FILE_NAME,
  filePath: string = FILE_PATH,
  contentType: string = CONTENT_TYPE,
  fileSizeMb: number = FILE_SIZE_MB
): Promise<DeaCaseFile> {
  const initiateUploadResponse = await callDeaAPIWithCreds(
    `${DEA_API_URL}cases/${caseUlid}/files`,
    'POST',
    idToken,
    creds,
    {
      caseUlid: caseUlid,
      fileName: fileName,
      filePath: filePath,
      contentType: contentType,
      fileSizeMb: fileSizeMb,
    }
  );

  expect(initiateUploadResponse.status).toEqual(200);
  const initiatedCaseFile: DeaCaseFile = await initiateUploadResponse.data;
  Joi.assert(initiatedCaseFile, caseFileResponseSchema);
  return initiatedCaseFile;
}

function uploadFile(
  presignedUrls: readonly string[],
  fileContent: string = FILE_CONTENT
): Promise<Response>[] {
  const uploadResponses: Promise<Response>[] = [];

  const httpClient = axios.create({
    headers: {
      'Content-Type': CONTENT_TYPE,
    },
  });

  presignedUrls.forEach((url, index) => {
    uploadResponses[index] = httpClient.put(url, fileContent, { validateStatus });
  });

  return uploadResponses;
}

async function completeCaseFileUploadAndValidate(
  idToken: string,
  creds: Credentials,
  deaCase: DeaCase,
  caseFile: DeaCaseFile,
  fileName: string = FILE_NAME,
  filePath: string = FILE_PATH,
  fileContent: string = FILE_CONTENT
): Promise<void> {
  const completeUploadResponse = await callDeaAPIWithCreds(
    `${DEA_API_URL}cases/${deaCase.ulid}/files/${caseFile.ulid}`,
    'PUT',
    idToken,
    creds,
    {
      caseUlid: deaCase.ulid,
      ulid: caseFile.ulid,
      uploadId: caseFile.uploadId,
      fileName: fileName,
      filePath: filePath,
      sha256Hash: sha256(fileContent).toString(),
    }
  );

  expect(completeUploadResponse.status).toEqual(200);
  const uploadedCaseFile: DeaCaseFile = await completeUploadResponse.data;
  Joi.assert(uploadedCaseFile, caseFileResponseSchema);
}
