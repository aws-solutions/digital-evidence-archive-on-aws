/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  CreateMultipartUploadCommand,
  S3Client,
  ServiceInputTypes,
  ServiceOutputTypes,
} from '@aws-sdk/client-s3';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import Joi from 'joi';
import { initiateCaseFileUpload } from '../../../app/resources/initiate-case-file-upload';
import { DeaCaseFile } from '../../../models/case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { ONE_TB } from '../../../models/validation/joi-common';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { bogusUlid, fakeUlid } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  CHUNK_SIZE_BYTES,
  DATASETS_PROVIDER,
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
const FILE_PATH = '/food/sushi/';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';
const CONTENT_TYPE = 'image/jpeg';

jest.setTimeout(30000);

describe('Test initiate case file upload', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('InitiateCaseFileUploadTest');

    fileUploader = await callCreateUser(repositoryProvider);
    caseToUploadTo = (await callCreateCase(fileUploader, repositoryProvider)).ulid ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  beforeEach(() => {
    // reset mock so that each test can validate its own set of mock calls
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
    });
  });

  it('should successfully initiate a file upload', async () => {
    const fileName = 'positive test';
    await initiateCaseFileUploadAndValidate(caseToUploadTo, fileName);
  });

  it('Initiate upload should throw a validation exception when no payload is provided', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
      },
    });
    await expect(
      initiateCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Initiate case file upload payload missing.');
  });

  it('Initiate upload should throw an exception when user does not exist in DB', async () => {
    await expect(callInitiateCaseFileUpload(FILE_ULID, repositoryProvider, caseToUploadTo)).rejects.toThrow(
      'Could not find case-file upload user'
    );
  });

  it('Initiate upload should throw an exception when no user provided in header', async () => {
    await expect(callInitiateCaseFileUpload(undefined, repositoryProvider, caseToUploadTo)).rejects.toThrow(
      'userUlid was not present in the event header'
    );
  });

  it('Initiate upload should throw an exception when case does not exist in DB', async () => {
    // use a bogus ULID
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, CASE_ULID)
    ).rejects.toThrow(`Could not find case`);
  });

  it('Initiate upload should throw an exception when case is inactive', async () => {
    const inactiveCaseUlid =
      (await callCreateCase(fileUploader, repositoryProvider, 'inactive', 'inactive', CaseStatus.INACTIVE))
        .ulid ?? fail();
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, inactiveCaseUlid)
    ).rejects.toThrow('Case is in an invalid state for uploading files');
  });

  it('Initiate upload should throw an exception when case-file is PENDING', async () => {
    const pendingFileName = 'initiatePendingFile';
    await initiateCaseFileUploadAndValidate(caseToUploadTo, pendingFileName);
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, pendingFileName)
    ).rejects.toThrow(
      `${FILE_PATH}${pendingFileName} is currently being uploaded. Check again in 60 minutes`
    );
  });

  it('Initiate upload should throw an exception when case-file exists', async () => {
    const activeFileName = 'initiateActiveFile';
    const caseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate(caseToUploadTo, activeFileName);
    await callCompleteCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      caseFile.ulid as string,
      caseToUploadTo
    );

    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, activeFileName)
    ).rejects.toThrow('File already exists in the DB');
  });

  it('Initiate upload should enforce a strict payload', async () => {
    // validate caseUlid
    await expect(callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, 'ABCD')).rejects.toThrow();
    await expect(callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, '')).rejects.toThrow();

    // validate fileName
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, '')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, '/food/ramen.jpg')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, 'hello\0')
    ).rejects.toThrow();

    // allowed fileNames
    expect(
      await callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, 'ramen.jpg')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, '01234')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, 'ramen-jpg')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, 'ramen_jpg')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, 'ramen jpg')
    ).toBeDefined();

    // validate filePath
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, FILE_NAME, 'foo')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, FILE_NAME, '')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, FILE_NAME, 'foo\\')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, FILE_NAME, 'foo&&')
    ).rejects.toThrow();

    // allowed filePaths
    expect(
      await callInitiateCaseFileUpload(fileUploader.ulid, repositoryProvider, caseToUploadTo, FILE_NAME, '/')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(
        fileUploader.ulid,
        repositoryProvider,
        caseToUploadTo,
        FILE_NAME,
        '/foo/'
      )
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(
        fileUploader.ulid,
        repositoryProvider,
        caseToUploadTo,
        FILE_NAME,
        '/foo/bar/'
      )
    ).toBeDefined();

    // validate fileSizeBytes
    await expect(
      callInitiateCaseFileUpload(
        fileUploader.ulid,
        repositoryProvider,
        caseToUploadTo,
        FILE_NAME,
        FILE_PATH,
        CONTENT_TYPE,
        0
      )
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(
        fileUploader.ulid,
        repositoryProvider,
        caseToUploadTo,
        FILE_NAME,
        FILE_PATH,
        CONTENT_TYPE,
        -1
      )
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(
        fileUploader.ulid,
        repositoryProvider,
        caseToUploadTo,
        FILE_NAME,
        FILE_PATH,
        CONTENT_TYPE,
        6 * ONE_TB
      )
    ).rejects.toThrow();
  });

  it('should error if the payload and resource ids do not match', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: bogusUlid,
      },
      body: JSON.stringify({
        caseUlid: fakeUlid,
        fileName: 'bogus',
        filePath: '/',
        contentType: 'image/jpeg',
        fileSizeBytes: 1,
        reason: '123',
        details: 'u&me',
        chunkSizeBytes: 5242881,
      }),
    });
    await expect(
      initiateCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Requested Case Ulid does not match resource');
  });

  it('should error if the fileSizeBytes is a negative number in exponential notation', async () => {
    const event = getDummyEvent({
      headers: {
        userUlid: fileUploader.ulid,
      },
      pathParameters: {
        caseId: caseToUploadTo,
      },
      body: JSON.stringify({
        caseUlid: caseToUploadTo,
        fileName: 'bogus',
        filePath: '/',
        contentType: 'image/jpeg',
        fileSizeBytes: 1e-300,
        tag: 'abc',
        reason: '123',
        details: 'u&me',
        chunkSizeBytes: 5242881,
      }),
    });
    await expect(
      initiateCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow(Joi.ValidationError);
  });

  it('should error if the fileSizeBytes is a greater than 5TB', async () => {
    const event = getDummyEvent({
      headers: {
        userUlid: fileUploader.ulid,
      },
      pathParameters: {
        caseId: caseToUploadTo,
      },
      body: JSON.stringify({
        caseUlid: caseToUploadTo,
        fileName: 'bogus',
        filePath: '/',
        contentType: 'image/jpeg',
        fileSizeBytes: 5 * ONE_TB + 1,
        tag: 'abc',
        reason: '123',
        details: 'u&me',
        chunkSizeBytes: 5242881,
      }),
    });
    await expect(
      initiateCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow(Joi.ValidationError);
  });
});

async function initiateCaseFileUploadAndValidate(caseUlid: string, fileName: string): Promise<DeaCaseFile> {
  const deaCaseFile = await callInitiateCaseFileUpload(
    fileUploader.ulid,
    repositoryProvider,
    caseUlid,
    fileName
  );
  await validateCaseFile(
    deaCaseFile,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    deaCaseFile.ulid as string,
    caseUlid,
    fileUploader.ulid,
    CaseFileStatus.PENDING,
    fileName
  );

  // initiate-case-file should return chunkSizeBytes in its response
  expect(deaCaseFile.chunkSizeBytes).toEqual(CHUNK_SIZE_BYTES);

  expect(s3Mock).toHaveReceivedCommandTimes(CreateMultipartUploadCommand, 1);
  expect(s3Mock).toHaveReceivedCommandWith(CreateMultipartUploadCommand, {
    Bucket: DATASETS_PROVIDER.bucketName,
    Key: `${caseUlid}/${deaCaseFile.ulid}`,
    BucketKeyEnabled: true,
    ServerSideEncryption: 'aws:kms',
    ContentType: CONTENT_TYPE,
    StorageClass: 'INTELLIGENT_TIERING',
  });
  return deaCaseFile;
}
