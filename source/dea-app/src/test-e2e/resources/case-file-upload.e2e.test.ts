/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import fs from 'fs';
import axios from 'axios';
import sha256 from 'crypto-js/sha256';
import Joi from 'joi';
import { DeaCaseFile } from '../../models/case-file';
import { CaseStatus } from '../../models/case-status';
import { caseFileResponseSchema } from '../../models/validation/case-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

const CONTENT_TYPE = 'application/octet-stream';
export const validateStatus = () => true;

describe('Test case file upload', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = 'caseFileUploadTestUser';
  const deaApiUrl = testEnv.apiUrlOutput;

  const caseIdsToDelete: string[] = [];

  jest.setTimeout(30000);

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'CaseWorkerGroup', 'CaseFile', 'Uploader');
  });

  afterAll(async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, idToken, creds);
    }

    // todo: delete s3 objects
    await cognitoHelper.cleanup();
  });

  it('Upload a case file', async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    const caseName = 'CASE with files';

    const createdCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: caseName,
        status: CaseStatus.ACTIVE,
        description: 'this is a description',
      },
      idToken,
      creds
    );
    caseIdsToDelete.push(createdCase.ulid ?? fail());

    const initiateUploadResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/files`,
      'POST',
      idToken,
      creds,
      {
        caseUlid: createdCase.ulid,
        fileName: 'filename',
        filePath: '/',
        contentType: CONTENT_TYPE,
        fileSizeMb: 1,
      }
    );

    console.log(initiateUploadResponse);
    expect(initiateUploadResponse.status).toEqual(200);
    const initiatedCaseFile: DeaCaseFile = await initiateUploadResponse.data;
    Joi.assert(initiatedCaseFile, caseFileResponseSchema);

    const presignedUrls = initiatedCaseFile.presignedUrls ?? [];
    const uploadPromises: Promise<Response>[] = [];

    const file = fs.readFileSync('/tmp/helloworld');
    const httpClient = axios.create({
      headers: {
        'Content-Type': CONTENT_TYPE,
      },
    });

    console.log('initiate completed');
    presignedUrls.forEach((url, index) => {
      console.log(`presigned url: ${url}`);
      uploadPromises[index] = httpClient.put(url, file, { validateStatus });
    });

    await Promise.all(uploadPromises);
    console.log(uploadPromises);
    const completeUploadResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/files/${initiatedCaseFile.ulid}`,
      'PUT',
      idToken,
      creds,
      {
        caseUlid: createdCase.ulid,
        ulid: initiatedCaseFile.ulid,
        uploadId: initiatedCaseFile.uploadId,
        fileName: 'filename',
        filePath: '/',
        sha256Hash: sha256(file.toString()).toString(),
      }
    );

    console.log(completeUploadResponse);

    expect(completeUploadResponse.status).toEqual(200);
    const uploadedCaseFile: DeaCaseFile = await completeUploadResponse.data;
    Joi.assert(uploadedCaseFile, caseFileResponseSchema);
  });
});
