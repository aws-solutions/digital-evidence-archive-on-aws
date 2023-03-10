/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { Credentials } from 'aws4-axios';
import sha256 from 'crypto-js/sha256';
import { DeaCase } from '../../models/case';
import { DeaCaseFile } from '../../models/case-file';
import { CaseFileStatus } from '../../models/case-file-status';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  completeCaseFileUploadSuccess,
  createCaseSuccess,
  deleteCase,
  describeCaseFileDetailsSuccess,
  downloadContentFromS3,
  getCaseFileDownloadUrl,
  initiateCaseFileUploadSuccess,
  listCaseFilesSuccess,
  randomSuffix,
  s3Cleanup,
  s3Object,
  uploadContentToS3,
} from './test-helpers';

const FILE_PATH = '/food/sushi/';
const FILE_CONTENT = 'hello world';
const TEST_USER = 'caseFileUploadTestUser';
const FILE_SIZE_MB = 50;
const DEA_API_URL = testEnv.apiUrlOutput;

describe('Test case file APIs', () => {
  const cognitoHelper = new CognitoHelper();

  const caseIdsToDelete: string[] = [];
  const s3ObjectsToDelete: s3Object[] = [];

  jest.setTimeout(30000);

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(TEST_USER, 'CaseWorker', 'CaseFile', 'Uploader');
  });

  afterAll(async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(TEST_USER);

    for (const caseId of caseIdsToDelete) {
      await deleteCase(DEA_API_URL, caseId, idToken, creds);
    }

    await cognitoHelper.cleanup();

    await s3Cleanup(s3ObjectsToDelete);
  });

  it('Upload a case file', async () => {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(TEST_USER);

    const createdCase = await createCase(idToken, creds);
    const caseUlid = createdCase.ulid ?? fail();
    caseIdsToDelete.push(caseUlid);

    // verify list-case-files returns zero case-files
    let listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, FILE_PATH);
    expect(listCaseFilesResponse.cases.length).toEqual(0);
    expect(listCaseFilesResponse.next).toBeUndefined();

    // initiate upload
    const initiatedCaseFile: DeaCaseFile = await initiateCaseFileUploadSuccess(
      DEA_API_URL,
      idToken,
      creds,
      caseUlid,
      'positiveTest',
      FILE_PATH,
      FILE_SIZE_MB
    );

    const initiatedCaseFile2: DeaCaseFile = await initiateCaseFileUploadSuccess(
      DEA_API_URL,
      idToken,
      creds,
      caseUlid,
      'colocatedPositiveTest',
      FILE_PATH,
      FILE_SIZE_MB
    );

    const fileUlid = initiatedCaseFile.ulid ?? fail();
    const fileUlid2 = initiatedCaseFile2.ulid ?? fail();
    s3ObjectsToDelete.push({ key: `${caseUlid}/${fileUlid}`, uploadId: initiatedCaseFile.uploadId });
    s3ObjectsToDelete.push({ key: `${caseUlid}/${fileUlid2}`, uploadId: initiatedCaseFile2.uploadId });
    const uploadId = initiatedCaseFile.uploadId ?? fail();
    const uploadId2 = initiatedCaseFile2.uploadId ?? fail();
    const presignedUrls = initiatedCaseFile.presignedUrls ?? fail();
    const presignedUrls2 = initiatedCaseFile2.presignedUrls ?? fail();

    // verify list-case-files and describe-case-file match expected state after initiate-upload
    listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, FILE_PATH);
    expect(listCaseFilesResponse.cases.length).toEqual(2);
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
      listCaseFilesResponse.cases.find((caseFile) => caseFile.fileName === describedCaseFile.fileName)
    ).toBeTruthy();

    // complete upload
    await uploadContentToS3(presignedUrls, FILE_CONTENT);
    await uploadContentToS3(presignedUrls2, FILE_CONTENT);
    await completeCaseFileUploadSuccess(
      DEA_API_URL,
      idToken,
      creds,
      caseUlid,
      fileUlid,
      uploadId,
      FILE_CONTENT
    );

    await completeCaseFileUploadSuccess(
      DEA_API_URL,
      idToken,
      creds,
      caseUlid,
      fileUlid2,
      uploadId2,
      FILE_CONTENT
    );

    // verify list-case-files and describe-case-file match expected state after complete-upload
    listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, '/');
    expect(listCaseFilesResponse.cases.length).toEqual(1);
    expect(listCaseFilesResponse.cases[0].fileName).toEqual('food');
    expect(listCaseFilesResponse.cases[0].isFile).toEqual(false);
    listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, '/food/');
    expect(listCaseFilesResponse.cases.length).toEqual(1);
    expect(listCaseFilesResponse.cases[0].fileName).toEqual('sushi');
    expect(listCaseFilesResponse.cases[0].isFile).toEqual(false);
    listCaseFilesResponse = await listCaseFilesSuccess(DEA_API_URL, idToken, creds, caseUlid, FILE_PATH);
    expect(listCaseFilesResponse.cases.length).toEqual(2);
    expect(listCaseFilesResponse.next).toBeUndefined();
    describedCaseFile = await describeCaseFileDetailsSuccess(DEA_API_URL, idToken, creds, caseUlid, fileUlid);
    expect(describedCaseFile.status).toEqual(CaseFileStatus.ACTIVE);
    expect(
      listCaseFilesResponse.cases.find((caseFile) => caseFile.fileName === describedCaseFile.fileName)
    ).toBeTruthy();

    // verify download-case-file works as expected
    const downloadUrl = await getCaseFileDownloadUrl(DEA_API_URL, idToken, creds, caseUlid, fileUlid);
    const downloadedContent = await downloadContentFromS3(downloadUrl, describedCaseFile.contentType);
    expect(downloadedContent).toEqual(FILE_CONTENT);
    expect(sha256(downloadedContent).toString()).toEqual(describedCaseFile.sha256Hash);
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createCase(idToken: string, creds: Credentials): Promise<DeaCase> {
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
