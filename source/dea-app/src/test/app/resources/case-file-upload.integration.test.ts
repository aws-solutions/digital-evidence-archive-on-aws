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
  CompleteMultipartUploadCommand,
  ListPartsCommand,
  PutObjectLegalHoldCommand,
  ObjectLockLegalHoldStatus,
} from '@aws-sdk/client-s3';
import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { completeCaseFileUpload } from '../../../app/resources/complete-case-file-upload';
import { createCases } from '../../../app/resources/create-cases';
import { initiateCaseFileUpload } from '../../../app/resources/initiate-case-file-upload';
import { DeaCase } from '../../../models/case';
import { DeaCaseFile } from '../../../models/case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let fileUploader: DeaUser;
let caseToUploadTo = '';

const CASE_NAME = 'Dinner';
const CASE_DESCRIPTION = 'Yummy';
const FILE_NAME = 'tuna.jpeg';
const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const FILE_PATH = '/food/sushi/';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';
const SHA256_HASH = '030A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFF02EBE0B';
const FILE_SIZE_MB = 50;
const CONTENT_TYPE = 'image/jpeg';
const DATASETS_PROVIDER = {
  s3Client: new S3Client({ region: 'us-east-1' }),
  bucketName: 'testBucket',
  chunkSizeMB: 500,
  presignedCommandExpirySeconds: 3600,
};

const EVENT = dummyEvent;

jest.setTimeout(20000);

describe('Test case file upload', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('CaseFileUploadTest');

    fileUploader =
      (await createUser(
        {
          tokenId: 'fileuploader',
          firstName: 'File',
          lastName: 'Uploader',
        },
        repositoryProvider
      )) ?? fail();
    EVENT.headers['userUlid'] = fileUploader.ulid;
    caseToUploadTo = (await createCase()).ulid ?? fail();
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
    const caseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate();
    await completeCaseFileUploadAndValidate(caseFile.ulid);
  });

  it('should throw a validation exception when no payload is provided', async () => {
    await expect(
      initiateCaseFileUpload(EVENT, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Initiate case file upload payload missing.');
    await expect(
      completeCaseFileUpload(EVENT, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Complete case file upload payload missing.');
  });

  it('should throw an exception when user does not exist in DB', async () => {
    EVENT.headers['userUlid'] = FILE_ULID; // use a fake ulid
    await expect(callInitiateCaseFileUpload()).rejects.toThrow(
      'Could not find case-file uploader as a user in the DB'
    );
    await expect(callCompleteCaseFileUpload()).rejects.toThrow(
      'Could not find case-file uploader as a user in the DB'
    );

    delete EVENT.headers['userUlid'];
    await expect(callInitiateCaseFileUpload()).rejects.toThrow(
      'userUlid was not present in the event header'
    );
    await expect(callCompleteCaseFileUpload()).rejects.toThrow(
      'userUlid was not present in the event header'
    );
  });

  it('should throw an exception when case does not exist in DB', async () => {
    // use a bogus ULID
    await expect(callInitiateCaseFileUpload(FILE_ULID)).rejects.toThrow(
      `Could not find case: ${FILE_ULID} in the DB`
    );
    await expect(callCompleteCaseFileUpload(FILE_ULID, FILE_ULID)).rejects.toThrow(
      `Could not find case: ${FILE_ULID} in the DB`
    );
  });

  it('should throw an exception when case is inactive', async () => {
    const inactiveCaseUlid = (await createCase('inactive', 'inactive', 'INACTIVE')).ulid ?? fail();
    await expect(callInitiateCaseFileUpload(inactiveCaseUlid)).rejects.toThrow(
      "Can't upload a file to case in INACTIVE state"
    );
    await expect(callCompleteCaseFileUpload(FILE_ULID, inactiveCaseUlid)).rejects.toThrow(
      "Can't upload a file to case in INACTIVE state"
    );
  });

  it('initiate upload should throw an exception when case-file is PENDING', async () => {
    const pendingFileName = 'initiatePendingFile';
    await initiateCaseFileUploadAndValidate(caseToUploadTo, pendingFileName);
    await expect(callInitiateCaseFileUpload(caseToUploadTo, pendingFileName)).rejects.toThrow(
      `${FILE_PATH}${pendingFileName} is currently being uploaded. Check again in 60 minutes`
    );
  });

  it('initiate upload should throw an exception when case-file exists', async () => {
    const activeFileName = 'initiateActiveFile';
    const caseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate(caseToUploadTo, activeFileName);
    await completeCaseFileUploadAndValidate(caseFile.ulid, caseToUploadTo, activeFileName);

    await expect(callInitiateCaseFileUpload(caseToUploadTo, activeFileName)).rejects.toThrow(
      `${FILE_PATH}${activeFileName} already exists in the DB`
    );
  });

  it("complete upload should throw an exception when case-file doesn't exist", async () => {
    await expect(callCompleteCaseFileUpload(FILE_ULID)).rejects.toThrow(
      `Could not find file: ${FILE_ULID} in the DB`
    );
  });

  it("complete upload should throw an exception when case-file isn't pending", async () => {
    const activeFileName = 'completeActiveFile';
    const caseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate(caseToUploadTo, activeFileName);
    await completeCaseFileUploadAndValidate(caseFile.ulid, caseToUploadTo, activeFileName);

    await expect(callCompleteCaseFileUpload(caseFile.ulid, caseToUploadTo, activeFileName)).rejects.toThrow(
      `Can't complete upload for a file in ${CaseFileStatus.ACTIVE} state`
    );
  });

  it('complete upload should throw an exception when caller is different user', async () => {
    const activeFileName = 'mismatchUserFile';
    const caseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate(caseToUploadTo, activeFileName);

    const newFileUploader =
      (await createUser(
        {
          tokenId: 'newfileuploader',
          firstName: 'NewFile',
          lastName: 'Uploader',
        },
        repositoryProvider
      )) ?? fail();
    EVENT.headers['userUlid'] = newFileUploader.ulid;

    await expect(callCompleteCaseFileUpload(caseFile.ulid, caseToUploadTo, activeFileName)).rejects.toThrow(
      'Mismatch in user creating and completing file upload'
    );
  });

  it('initiate upload should enforce a strict payload', async () => {
    // validate caseUlid
    await expect(callInitiateCaseFileUpload('ABCD')).rejects.toThrow();
    await expect(callInitiateCaseFileUpload('')).rejects.toThrow();

    // validate fileName
    await expect(callInitiateCaseFileUpload(caseToUploadTo, '')).rejects.toThrow();
    await expect(callInitiateCaseFileUpload(caseToUploadTo, '/food/ramen.jpg')).rejects.toThrow();
    await expect(callInitiateCaseFileUpload(caseToUploadTo, 'hello\0')).rejects.toThrow();

    // allowed fileNames
    expect(await callInitiateCaseFileUpload(caseToUploadTo, 'ramen.jpg')).toBeDefined();
    expect(await callInitiateCaseFileUpload(caseToUploadTo, '01234')).toBeDefined();
    expect(await callInitiateCaseFileUpload(caseToUploadTo, 'ramen-jpg')).toBeDefined();
    expect(await callInitiateCaseFileUpload(caseToUploadTo, 'ramen_jpg')).toBeDefined();
    expect(await callInitiateCaseFileUpload(caseToUploadTo, 'ramen jpg')).toBeDefined();

    // validate filePath
    await expect(callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, 'foo')).rejects.toThrow();
    await expect(callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, '')).rejects.toThrow();
    await expect(callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, 'foo\\')).rejects.toThrow();
    await expect(callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, 'foo&&')).rejects.toThrow();

    // allowed filePaths
    expect(await callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, '/')).toBeDefined();
    expect(await callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, '/foo/')).toBeDefined();
    expect(await callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, '/foo/bar/')).toBeDefined();

    // validate fileSizeMb
    await expect(
      callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, FILE_PATH, CONTENT_TYPE, 0)
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, FILE_PATH, CONTENT_TYPE, -1)
    ).rejects.toThrow();
    await expect(
      callInitiateCaseFileUpload(caseToUploadTo, FILE_NAME, FILE_PATH, CONTENT_TYPE, 5_000_001)
    ).rejects.toThrow();

    // allowed fileSizeMb
    expect(
      await callInitiateCaseFileUpload(caseToUploadTo, 'huge file', FILE_PATH, CONTENT_TYPE, 4_999_999)
    ).toBeDefined();
    expect(
      await callInitiateCaseFileUpload(caseToUploadTo, 'tiny file', FILE_PATH, CONTENT_TYPE, 1)
    ).toBeDefined();
  });

  it('complete upload should enforce a strict payload', async () => {
    // validate caseUlid
    await expect(callCompleteCaseFileUpload(FILE_ULID, 'ABCD')).rejects.toThrow();
    await expect(callCompleteCaseFileUpload(FILE_ULID, '')).rejects.toThrow();

    // validate fileName
    await expect(callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, '')).rejects.toThrow();
    await expect(callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, '/food/ramen.jpg')).rejects.toThrow();
    await expect(callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, 'hello\0')).rejects.toThrow();

    // validate filePath
    await expect(callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, 'foo')).rejects.toThrow();
    await expect(callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, '')).rejects.toThrow();
    await expect(callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, 'foo\\')).rejects.toThrow();
    await expect(callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, 'foo&&')).rejects.toThrow();

    // validate ulid
    await expect(
      callCompleteCaseFileUpload('ABCD', caseToUploadTo, FILE_NAME, CONTENT_TYPE)
    ).rejects.toThrow();
    await expect(callCompleteCaseFileUpload('', caseToUploadTo, FILE_NAME, CONTENT_TYPE)).rejects.toThrow();

    // validate s3Identifier
    await expect(
      callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, CONTENT_TYPE, '&&')
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, CONTENT_TYPE, '"foo"')
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, CONTENT_TYPE, "'foo'")
    ).rejects.toThrow();
    await expect(
      callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, CONTENT_TYPE, '<food>')
    ).rejects.toThrow();

    // validate sha256Hash
    await expect(
      callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, CONTENT_TYPE, UPLOAD_ID, '')
    ).rejects.toThrow(); // empty hash
    await expect(
      callCompleteCaseFileUpload(FILE_ULID, caseToUploadTo, FILE_NAME, CONTENT_TYPE, UPLOAD_ID, 'sha')
    ).rejects.toThrow(); // short hash
    await expect(
      callCompleteCaseFileUpload(
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

async function initiateCaseFileUploadAndValidate(
  caseUlid: string = caseToUploadTo,
  fileName: string = FILE_NAME,
  filePath: string = FILE_PATH,
  contentType: string = CONTENT_TYPE,
  fileSizeMb: number = FILE_SIZE_MB
): Promise<DeaCaseFile> {
  const response = await callInitiateCaseFileUpload(caseUlid, fileName, filePath, contentType, fileSizeMb);
  const deaCaseFile = await validateApiResponse(
    response,
    fileName,
    caseUlid,
    filePath,
    CaseFileStatus.PENDING,
    false
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

async function callInitiateCaseFileUpload(
  caseUlid: string = caseToUploadTo,
  fileName: string = FILE_NAME,
  filePath: string = FILE_PATH,
  contentType: string = CONTENT_TYPE,
  fileSizeMb: number = FILE_SIZE_MB
): Promise<APIGatewayProxyStructuredResultV2> {
  const event = Object.assign(
    {},
    {
      ...EVENT,
      body: JSON.stringify({
        caseUlid,
        fileName,
        filePath,
        contentType,
        fileSizeMb,
      }),
    }
  );
  return initiateCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
}

async function completeCaseFileUploadAndValidate(
  ulid: string = FILE_ULID,
  caseUlid: string = caseToUploadTo,
  fileName: string = FILE_NAME,
  filePath: string = FILE_PATH,
  uploadId: string = UPLOAD_ID,
  sha256Hash: string = SHA256_HASH
): Promise<DeaCaseFile> {
  const response = await callCompleteCaseFileUpload(ulid, caseUlid, fileName, filePath, uploadId, sha256Hash);
  const deaCaseFile = await validateApiResponse(
    response,
    fileName,
    caseUlid,
    filePath,
    CaseFileStatus.ACTIVE,
    true
  );

  expect(s3Mock).toHaveReceivedCommandTimes(ListPartsCommand, 1);
  expect(s3Mock).toHaveReceivedCommandTimes(CompleteMultipartUploadCommand, 1);

  expect(s3Mock).toHaveReceivedCommandWith(ListPartsCommand, {
    Bucket: DATASETS_PROVIDER.bucketName,
    Key: `${caseUlid}/${deaCaseFile.ulid}`,
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

async function callCompleteCaseFileUpload(
  ulid: string = FILE_ULID,
  caseUlid: string = caseToUploadTo,
  fileName: string = FILE_NAME,
  filePath: string = FILE_PATH,
  uploadId: string = UPLOAD_ID,
  sha256Hash: string = SHA256_HASH
): Promise<APIGatewayProxyStructuredResultV2> {
  const event = Object.assign(
    {},
    {
      ...EVENT,
      body: JSON.stringify({
        caseUlid,
        fileName,
        filePath,
        uploadId,
        sha256Hash,
        ulid,
      }),
    }
  );
  return completeCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
}

async function validateApiResponse(
  response: APIGatewayProxyStructuredResultV2,
  fileName: string,
  caseUlid: string,
  filePath: string,
  status: string,
  validateUploadComplete: boolean
): Promise<DeaCaseFile> {
  expect(response.statusCode).toEqual(200);

  if (!response.body) {
    fail();
  }

  const deaCaseFile: DeaCaseFile = JSON.parse(response.body);
  expect(deaCaseFile.fileName).toEqual(fileName);
  expect(deaCaseFile.caseUlid).toEqual(caseUlid);
  expect(deaCaseFile.filePath).toEqual(filePath);
  expect(deaCaseFile.createdBy).toEqual(fileUploader.ulid);
  expect(deaCaseFile.status).toEqual(status);

  if (validateUploadComplete) {
    const epochSecondsNow = Math.round(Date.now() / 1000);
    // check that ttl is between 55 - 65 minutes from now
    expect(deaCaseFile.ttl).toBeGreaterThan(epochSecondsNow + 60 * 55);
    expect(deaCaseFile.ttl).toBeLessThan(epochSecondsNow + 60 * 65);
  } else {
    expect(deaCaseFile.ttl).toBeUndefined();
    expect(deaCaseFile.versionId).toEqual(VERSION_ID);
  }

  return deaCaseFile;
}

async function createCase(
  name: string = CASE_NAME,
  description: string = CASE_DESCRIPTION,
  status = 'ACTIVE'
): Promise<DeaCase> {
  const event = Object.assign(
    {},
    {
      ...EVENT,
      body: JSON.stringify({
        name,
        status,
        description,
      }),
    }
  );

  const response = await createCases(event, dummyContext, repositoryProvider);

  expect(response.statusCode).toEqual(200);

  if (!response.body) {
    fail();
  }

  return JSON.parse(response.body);
}
