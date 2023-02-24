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
  CreateMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { initiateCaseFileUpload } from '../../../app/resources/initiate-case-file-upload';
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
const FILE_PATH = '/food/sushi/';
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

describe('Test initiate case file upload', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('InitiateCaseFileUploadTest');

    fileUploader = await callCreateUser(repositoryProvider);
    EVENT.headers['userUlid'] = fileUploader.ulid;
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
    });

    EVENT.headers['userUlid'] = fileUploader.ulid;
  });

  it('should successfully initiate a file upload', async () => {
    const fileName = 'positive test';
    await initiateCaseFileUploadAndValidate(caseToUploadTo, fileName);
  });

  it('Initiate upload should throw a validation exception when no payload is provided', async () => {
    await expect(
      initiateCaseFileUpload(EVENT, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Initiate case file upload payload missing.');
  });

  it('Initiate upload should throw an exception when user does not exist in DB', async () => {
    EVENT.headers['userUlid'] = FILE_ULID; // use a fake ulid
    await expect(callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo)).rejects.toThrow(
      'Could not find case-file uploader as a user in the DB'
    );
  });

  it('Initiate upload should throw an exception when no user provided in header', async () => {
    delete EVENT.headers['userUlid'];
    await expect(callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo)).rejects.toThrow(
      'userUlid was not present in the event header'
    );
  });

  it('Initiate upload should throw an exception when case does not exist in DB', async () => {
    // use a bogus ULID
    await expect(callInitiateCaseFileUpload(EVENT, repositoryProvider, CASE_ULID)).rejects.toThrow(
      `Could not find case: ${CASE_ULID} in the DB`
    );
  });

  it('Initiate upload should throw an exception when case is inactive', async () => {
    const inactiveCaseUlid =
      (await callCreateCase(fileUploader, repositoryProvider, 'inactive', 'inactive', CaseStatus.INACTIVE))
        .ulid ?? fail();
    await expect(callInitiateCaseFileUpload(EVENT, repositoryProvider, inactiveCaseUlid)).rejects.toThrow(
      "Can't upload a file to case in INACTIVE state"
    );
  });

  it('Initiate upload should throw an exception when case-file is PENDING', async () => {
    const pendingFileName = 'initiatePendingFile';
    await initiateCaseFileUploadAndValidate(caseToUploadTo, pendingFileName);
    await expect(
      callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, pendingFileName)
    ).rejects.toThrow(
      `${FILE_PATH}${pendingFileName} is currently being uploaded. Check again in 60 minutes`
    );
  });

  it('Initiate upload should throw an exception when case-file exists', async () => {
    const activeFileName = 'initiateActiveFile';
    const caseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate(caseToUploadTo, activeFileName);
    await callCompleteCaseFileUpload(
      EVENT,
      repositoryProvider,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      caseFile.ulid as string,
      caseToUploadTo,
      activeFileName
    );

    await expect(
      callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, activeFileName)
    ).rejects.toThrow(`${FILE_PATH}${activeFileName} already exists in the DB`);
  });

  it('Initiate upload should enforce a strict payload', async () => {
    // validate caseUlid
    await expect(callInitiateCaseFileUpload(EVENT, repositoryProvider, 'ABCD')).rejects.toThrow();
    await expect(callInitiateCaseFileUpload(EVENT, repositoryProvider, '')).rejects.toThrow();

    // validate fileName
    await expect(callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, '')).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, '/food/ramen.jpg')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, 'hello\0')
    ).rejects.toThrow();

    // allowed fileNames
    expect(
      await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, 'ramen.jpg')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, '01234')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, 'ramen-jpg')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, 'ramen_jpg')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, 'ramen jpg')
    ).toBeDefined();

    // validate filePath
    await expect(
      callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, FILE_NAME, 'foo')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, FILE_NAME, '')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, FILE_NAME, 'foo\\')
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, FILE_NAME, 'foo&&')
    ).rejects.toThrow();

    // allowed filePaths
    expect(
      await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, FILE_NAME, '/')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, FILE_NAME, '/foo/')
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToUploadTo, FILE_NAME, '/foo/bar/')
    ).toBeDefined();

    // validate fileSizeMb
    await expect(
      callInitiateCaseFileUpload(
        EVENT,
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
        EVENT,
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
        EVENT,
        repositoryProvider,
        caseToUploadTo,
        FILE_NAME,
        FILE_PATH,
        CONTENT_TYPE,
        5_000_001
      )
    ).rejects.toThrow();

    // allowed fileSizeMb
    expect(
      await callInitiateCaseFileUpload(
        EVENT,
        repositoryProvider,
        caseToUploadTo,
        'huge file',
        FILE_PATH,
        CONTENT_TYPE,
        4_999_999
      )
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(
        EVENT,
        repositoryProvider,
        caseToUploadTo,
        'tiny file',
        FILE_PATH,
        CONTENT_TYPE,
        1
      )
    ).toBeDefined();
  });
});

async function initiateCaseFileUploadAndValidate(caseUlid: string, fileName: string): Promise<DeaCaseFile> {
  const deaCaseFile = await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseUlid, fileName);
  await validateCaseFile(
    deaCaseFile,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    deaCaseFile.ulid as string,
    caseUlid,
    fileUploader.ulid,
    CaseFileStatus.PENDING,
    fileName
  );

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
