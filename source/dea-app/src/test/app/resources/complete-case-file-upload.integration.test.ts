/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  CompleteMultipartUploadCommand,
  ListPartsCommand,
  ObjectLockLegalHoldStatus,
  PutObjectLegalHoldCommand,
  S3Client,
  ServiceInputTypes,
  ServiceOutputTypes,
} from '@aws-sdk/client-s3';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { completeCaseFileUpload } from '../../../app/resources/complete-case-file-upload';
import { listCaseFilesByFilePath } from '../../../app/services/case-file-service';
import { DeaCaseFileResult } from '../../../models/case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { getCase } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid, fakeUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  callCompleteCaseFileUpload,
  callCreateCase,
  callCreateUser,
  callInitiateCaseFileUpload,
  DATASETS_PROVIDER,
  FILE_SIZE_BYTES,
  validateCaseFile,
} from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let fileUploader: DeaUser;
let caseToUploadTo = '';

const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const CASE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY0';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';

jest.setTimeout(30000);

describe('Test complete case file upload', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('CompleteCaseFileUploadTest');

    fileUploader = await callCreateUser(repositoryProvider);
    caseToUploadTo = (await callCreateCase(fileUploader, repositoryProvider)).ulid ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  beforeEach(() => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      Parts: [
        {
          ETag: 'I am an etag',
          PartNumber: 99,
        },
      ],
    });
  });

  it('should successfully complete a file upload', async () => {
    const fileName = 'positive test';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToUploadTo,
      fileName
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fileId = caseFile.ulid as string;
    await completeCaseFileUploadAndValidate(fileId, caseToUploadTo, fileName);

    const updatedCase = (await getCase(caseToUploadTo, undefined, repositoryProvider)) ?? fail();
    expect(updatedCase.objectCount).toEqual(1);
    expect(updatedCase.totalSizeBytes).toEqual(FILE_SIZE_BYTES);
  });

  it('should successfully complete a file upload and create no duplicate path entries', async () => {
    const caseToUploadTo =
      (await callCreateCase(fileUploader, repositoryProvider, 'two files in a case')).ulid ?? fail();
    const fileName = 'file1.png';
    const fileName2 = 'file2.png';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToUploadTo,
      fileName
    );
    const caseFile2 = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToUploadTo,
      fileName2
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fileId = caseFile.ulid as string;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fileId2 = caseFile2.ulid as string;
    await completeCaseFileUploadAndValidate(fileId, caseToUploadTo, fileName);
    await completeCaseFileUploadAndValidate(fileId2, caseToUploadTo, fileName2, 2);

    const result = await listCaseFilesByFilePath(caseToUploadTo, '/', undefined, repositoryProvider);
    expect(result.length).toEqual(1);
    expect(result[0].fileName).toEqual('food');

    const updatedCase = (await getCase(caseToUploadTo, undefined, repositoryProvider)) ?? fail();
    expect(updatedCase.objectCount).toEqual(2);
    expect(updatedCase.totalSizeBytes).toEqual(FILE_SIZE_BYTES * 2);
  });

  it('Complete upload should throw a validation exception when no payload is provided', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
      },
    });
    await expect(
      completeCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Complete case file upload payload missing.');
  });

  it('Complete upload should throw an exception when user does not exist in DB', async () => {
    await expect(
      callCompleteCaseFileUpload(FILE_ULID, repositoryProvider, FILE_ULID, CASE_ULID)
    ).rejects.toThrow('Could not find case-file uploader as a user in the DB');
  });

  it('Complete upload should throw an exception when userId not present in headers', async () => {
    await expect(
      callCompleteCaseFileUpload(undefined, repositoryProvider, FILE_ULID, CASE_ULID)
    ).rejects.toThrow('userUlid was not present in the event header');
  });

  it('Complete upload should throw an exception when case does not exist in DB', async () => {
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, FILE_ULID, CASE_ULID)
    ).rejects.toThrow(`Could not find case: ${CASE_ULID} in the DB`);
  });

  it('Complete upload should throw an exception when case is inactive', async () => {
    const inactiveCaseUlid =
      (await callCreateCase(fileUploader, repositoryProvider, 'inactive', 'inactive', CaseStatus.INACTIVE))
        .ulid ?? fail();
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, FILE_ULID, inactiveCaseUlid)
    ).rejects.toThrow("Can't upload a file to case in INACTIVE state");
  });

  it("Complete upload should throw an exception when case-file doesn't exist", async () => {
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, FILE_ULID, caseToUploadTo)
    ).rejects.toThrow(`Could not find file: ${FILE_ULID} in the DB`);
  });

  it("Complete upload should throw an exception when case-file isn't pending", async () => {
    const activeFileName = 'completeActiveFile';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToUploadTo,
      activeFileName
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fileId = caseFile.ulid as string;
    await completeCaseFileUploadAndValidate(fileId, caseToUploadTo, activeFileName);

    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToUploadTo)
    ).rejects.toThrow(`Can't complete upload for a file in ${CaseFileStatus.ACTIVE} state`);
  });

  it('Complete upload should throw an exception when caller is different user', async () => {
    const activeFileName = 'mismatchUserFile';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToUploadTo,
      activeFileName
    );

    const newFileUploader = (await callCreateUser(repositoryProvider, 'fail', 'fail', 'fail')) ?? fail();
    if (!caseFile.ulid) {
      fail();
    }

    await expect(
      callCompleteCaseFileUpload(newFileUploader.ulid, repositoryProvider, caseFile.ulid, caseToUploadTo)
    ).rejects.toThrow('Mismatch in user creating and completing file upload');
  });

  it('Complete upload should enforce a strict payload', async () => {
    // validate caseUlid
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, FILE_ULID, 'ABCD')
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, FILE_ULID, '')
    ).rejects.toThrow();

    // validate ulid
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, 'ABCD', caseToUploadTo)
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, '', caseToUploadTo)
    ).rejects.toThrow();

    // validate sha256Hash
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, FILE_ULID, caseToUploadTo, '')
    ).rejects.toThrow(); // empty hash
    await expect(
      callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, FILE_ULID, caseToUploadTo, 'sha')
    ).rejects.toThrow(); // short hash
    await expect(
      callCompleteCaseFileUpload(
        fileUploader.ulid,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        '030A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFFFF02EBE0'
      )
    ).rejects.toThrow(); // long hash
    await expect(
      callCompleteCaseFileUpload(
        fileUploader.ulid,
        repositoryProvider,
        FILE_ULID,
        caseToUploadTo,
        '&30A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFF02EBE0B'
      )
    ).rejects.toThrow(); // illegal character
  });

  it('should error if the payload and resource ids do not match', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
      },
      body: JSON.stringify({
        caseUlid: fakeUlid,
        sha256Hash: '030A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFF02EBE0B',
        ulid: bogusUlid,
      }),
    });
    await expect(
      completeCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Requested Case Ulid does not match resource');
  });
});

async function completeCaseFileUploadAndValidate(
  ulid: string,
  caseUlid: string,
  fileName: string,
  callCount = 1
): Promise<DeaCaseFileResult> {
  const deaCaseFile = await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, ulid, caseUlid);
  await validateCaseFile(deaCaseFile, ulid, caseUlid, fileUploader.ulid, CaseFileStatus.ACTIVE, fileName);

  expect(s3Mock).toHaveReceivedCommandTimes(ListPartsCommand, callCount);
  expect(s3Mock).toHaveReceivedCommandTimes(CompleteMultipartUploadCommand, callCount);

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

  expect(s3Mock).toHaveReceivedCommandTimes(PutObjectLegalHoldCommand, callCount);
  expect(s3Mock).toHaveReceivedCommandWith(PutObjectLegalHoldCommand, {
    Bucket: DATASETS_PROVIDER.bucketName,
    Key: `${caseUlid}/${deaCaseFile.ulid}`,
    LegalHold: { Status: ObjectLockLegalHoldStatus.ON },
  });

  return deaCaseFile;
}
