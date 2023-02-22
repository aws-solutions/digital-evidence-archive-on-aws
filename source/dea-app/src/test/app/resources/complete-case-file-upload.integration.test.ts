/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import 'aws-sdk-client-mock-jest';
import { fail } from 'assert';
import {
  S3Client,
  ServiceInputTypes,
  ServiceOutputTypes,
  CompleteMultipartUploadCommand,
  ListPartsCommand,
  PutObjectLegalHoldCommand,
  ObjectLockLegalHoldStatus,
} from '@aws-sdk/client-s3';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { completeCaseFileUpload } from '../../../app/resources/complete-case-file-upload';
import { DeaCaseFile } from '../../../models/case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  callCompleteCaseFileUpload,
  callCreateCase,
  callCreateUser,
  callInitiateCaseFileUpload,
  validateCaseFile,
} from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let fileUploader: DeaUser;
let caseToUploadTo = '';

const FILE_NAME = 'tuna.jpeg';
const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const CASE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY0';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';
const CONTENT_TYPE = 'image/jpeg';
const DATASETS_PROVIDER = {
  s3Client: new S3Client({ region: 'us-east-1' }),
  bucketName: 'testBucket',
  chunkSizeMB: 500,
  presignedCommandExpirySeconds: 3600,
};

const EVENT = dummyEvent;

jest.setTimeout(20000);

describe('Test complete case file upload', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('CompleteCaseFileUploadTest');

    fileUploader = await callCreateUser(repositoryProvider);
    EVENT.headers['userUlid'] = fileUploader.ulid;
    caseToUploadTo = (await callCreateCase(EVENT, repositoryProvider)).ulid ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  beforeEach(() => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
    });

    EVENT.headers['userUlid'] = fileUploader.ulid;
  });

  it('should successfully complete a file upload', async () => {
    const fileName = 'positive test';
    const caseFile: DeaCaseFile = await callInitiateCaseFileUpload(
      EVENT,
      repositoryProvider,
      caseToUploadTo,
      fileName
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fileId = caseFile.ulid as string;
    await completeCaseFileUploadAndValidate(fileId, caseToUploadTo, fileName);
  });

  it('Complete upload should throw a validation exception when no payload is provided', async () => {
    await expect(
      completeCaseFileUpload(EVENT, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Complete case file upload payload missing.');
  });

  it('Complete upload should throw an exception when user does not exist in DB', async () => {
    EVENT.headers['userUlid'] = FILE_ULID; // use a fake ulid
    await expect(callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, CASE_ULID)).rejects.toThrow(
      'Could not find case-file uploader as a user in the DB'
    );
  });

  it('Complete upload should throw an exception when userId not present in headers', async () => {
    delete EVENT.headers['userUlid'];
    await expect(callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, CASE_ULID)).rejects.toThrow(
      'userUlid was not present in the event header'
    );
  });

  it('Complete upload should throw an exception when case does not exist in DB', async () => {
    await expect(callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, CASE_ULID)).rejects.toThrow(
      `Could not find case: ${CASE_ULID} in the DB`
    );
  });

  it('Complete upload should throw an exception when case is inactive', async () => {
    const inactiveCaseUlid =
      (await callCreateCase(EVENT, repositoryProvider, 'inactive', 'inactive', CaseStatus.INACTIVE)).ulid ??
      fail();
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, inactiveCaseUlid)
    ).rejects.toThrow("Can't upload a file to case in INACTIVE state");
  });

  it("Complete upload should throw an exception when case-file doesn't exist", async () => {
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, caseToUploadTo)
    ).rejects.toThrow(`Could not find file: ${FILE_ULID} in the DB`);
  });

  it("Complete upload should throw an exception when case-file isn't pending", async () => {
    const activeFileName = 'completeActiveFile';
    const caseFile: DeaCaseFile = await callInitiateCaseFileUpload(
      EVENT,
      repositoryProvider,
      caseToUploadTo,
      activeFileName
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fileId = caseFile.ulid as string;
    await completeCaseFileUploadAndValidate(fileId, caseToUploadTo, activeFileName);

    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, fileId, caseToUploadTo)
    ).rejects.toThrow(`Can't complete upload for a file in ${CaseFileStatus.ACTIVE} state`);
  });

  it('Complete upload should throw an exception when caller is different user', async () => {
    const activeFileName = 'mismatchUserFile';
    const caseFile: DeaCaseFile = await callInitiateCaseFileUpload(
      EVENT,
      repositoryProvider,
      caseToUploadTo,
      activeFileName
    );

    const newFileUploader = (await callCreateUser(repositoryProvider, 'fail', 'fail', 'fail')) ?? fail();
    EVENT.headers['userUlid'] = newFileUploader.ulid;

    await expect(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      callCompleteCaseFileUpload(EVENT, repositoryProvider, caseFile.ulid as string, caseToUploadTo)
    ).rejects.toThrow('Mismatch in user creating and completing file upload');
  });

  it('Complete upload should enforce a strict payload', async () => {
    // validate caseUlid
    await expect(callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, 'ABCD')).rejects.toThrow();
    await expect(callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, '')).rejects.toThrow();

    // validate fileName
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, caseToUploadTo, '')
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, caseToUploadTo, '/food/ramen.jpg')
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, caseToUploadTo, 'hello\0')
    ).rejects.toThrow();

    // validate filePath
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, caseToUploadTo, FILE_NAME, 'foo')
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, caseToUploadTo, FILE_NAME, '')
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, caseToUploadTo, FILE_NAME, 'foo\\')
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, FILE_ULID, caseToUploadTo, FILE_NAME, 'foo&&')
    ).rejects.toThrow();

    // validate ulid
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, 'ABCD', caseToUploadTo, FILE_NAME, CONTENT_TYPE)
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(EVENT, repositoryProvider, '', caseToUploadTo, FILE_NAME, CONTENT_TYPE)
    ).rejects.toThrow();

    // validate upload id
    await expect(
      callCompleteCaseFileUpload(
        EVENT,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        FILE_NAME,
        CONTENT_TYPE,
        '&&'
      )
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(
        EVENT,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        FILE_NAME,
        CONTENT_TYPE,
        '"foo"'
      )
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(
        EVENT,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        FILE_NAME,
        CONTENT_TYPE,
        "'foo'"
      )
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(
        EVENT,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        FILE_NAME,
        CONTENT_TYPE,
        '<food>'
      )
    ).rejects.toThrow();

    // validate sha256Hash
    await expect(
      callCompleteCaseFileUpload(
        EVENT,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        FILE_NAME,
        CONTENT_TYPE,
        UPLOAD_ID,
        ''
      )
    ).rejects.toThrow(); // empty hash
    await expect(
      callCompleteCaseFileUpload(
        EVENT,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        FILE_NAME,
        CONTENT_TYPE,
        UPLOAD_ID,
        'sha'
      )
    ).rejects.toThrow(); // short hash
    await expect(
      callCompleteCaseFileUpload(
        EVENT,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        FILE_NAME,
        CONTENT_TYPE,
        UPLOAD_ID,
        '030A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFFFF02EBE0'
      )
    ).rejects.toThrow(); // long hash
    await expect(
      callCompleteCaseFileUpload(
        EVENT,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        FILE_NAME,
        CONTENT_TYPE,
        UPLOAD_ID,
        '&30A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFF02EBE0B'
      )
    ).rejects.toThrow(); // illegal character
  });
});

async function completeCaseFileUploadAndValidate(
  ulid: string,
  caseUlid: string,
  fileName: string
): Promise<DeaCaseFile> {
  const deaCaseFile = await callCompleteCaseFileUpload(EVENT, repositoryProvider, ulid, caseUlid, fileName);
  await validateCaseFile(deaCaseFile, ulid, caseUlid, fileUploader.ulid, CaseFileStatus.ACTIVE, fileName);

  expect(s3Mock).toHaveReceivedCommandTimes(ListPartsCommand, 1);
  expect(s3Mock).toHaveReceivedCommandTimes(CompleteMultipartUploadCommand, 1);

  expect(s3Mock).toHaveReceivedCommandWith(ListPartsCommand, {
    Bucket: DATASETS_PROVIDER.bucketName,
    Key: `${caseUlid}/${ulid}`,
    UploadId: deaCaseFile.uploadId,
  });

  expect(s3Mock).toHaveReceivedCommandWith(CompleteMultipartUploadCommand, {
    Bucket: DATASETS_PROVIDER.bucketName,
    Key: `${caseUlid}/${deaCaseFile.ulid}`,
    UploadId: deaCaseFile.uploadId,
  });

  expect(s3Mock).toHaveReceivedCommandTimes(PutObjectLegalHoldCommand, 1);
  expect(s3Mock).toHaveReceivedCommandWith(PutObjectLegalHoldCommand, {
    Bucket: DATASETS_PROVIDER.bucketName,
    Key: `${caseUlid}/${deaCaseFile.ulid}`,
    LegalHold: { Status: ObjectLockLegalHoldStatus.ON },
  });

  return deaCaseFile;
}
