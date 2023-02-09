/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
//import fetch, { Response } from 'node-fetch';
import { DeaCaseFile } from '../../models/case-file';
import { CaseStatus } from '../../models/case-status';
import {
  completeCaseFileUploadResponseSchema,
  initiateCaseFileUploadResponseSchema,
} from '../../models/validation/case-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import { callDeaAPIWithCreds, createCaseSuccess, deleteCase } from './test-helpers';

const FILE_TYPE = 'image/jpeg';

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
        fileType: FILE_TYPE,
        fileSizeMb: 1,
      }
    );

    expect(initiateUploadResponse.status).toEqual(200);
    const initiatedCaseFile: DeaCaseFile = await initiateUploadResponse.data;
    Joi.assert(initiatedCaseFile, initiateCaseFileUploadResponseSchema);

    const presignedUrls = initiatedCaseFile.presignedUrls ?? [];
    const uploadPromises: Promise<Response>[] = [];

    presignedUrls.forEach((url, index) => {
      uploadPromises[index] = fetch(url, { body: 'hello world', method: 'PUT' });
    });

    await Promise.all(uploadPromises);
    const completeUploadResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/files/${initiatedCaseFile.ulid}`,
      'POST',
      idToken,
      creds,
      {
        caseUlid: createdCase.ulid,
        ulid: initiatedCaseFile.ulid,
        uploadId: initiatedCaseFile.uploadId,
        fileName: 'filename',
        filePath: '/',
        sha256Hash: 'B94D27B9934D3E08A52E52D7DA7DABFAC484EFE37A5380EE9088F7ACE2EFCDE9',
      }
    );

    expect(completeUploadResponse.status).toEqual(200);
    const uploadedCaseFile: DeaCaseFile = await completeUploadResponse.data;
    Joi.assert(uploadedCaseFile, completeCaseFileUploadResponseSchema);
  });
});
