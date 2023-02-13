/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { S3Client, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';
import { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { completeCaseFileUpload } from '../../../app/resources/complete-case-file-upload';
import { initiateCaseFileUpload } from '../../../app/resources/initiate-case-file-upload';
import { DeaCaseFile } from '../../../models/case-file';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;

const FILE_NAME = 'fileName';
const CASE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXYZ';
const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const FILE_PATH = '/food/sushi/';
const UPLOAD_ID = '123456';
const SHA256_HASH = '030A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFF02EBE0B';
const FILE_SIZE_MB = 50;
const CONTENT_TYPE = 'image/jpeg';
const DATASETS_PROVIDER = {
  s3Client: new S3Client({ region: 'us-east-1' }),
  bucketName: 'testBucket',
  chunkSizeMB: 5,
};

jest.setTimeout(20000);

describe('Test case file upload', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('CaseFileUploadTest');
    //todo: validate calls to s3 mock
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
    });
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should successfully complete a file upload', async () => {
    const caseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate();
    await completeCaseFileUploadAndValidate(caseFile.ulid);
  });

  it('should throw a validation exception when no payload is provided', async () => {
    await expect(
      initiateCaseFileUpload(dummyEvent, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Initiate case file upload payload missing.');
    await expect(
      completeCaseFileUpload(dummyEvent, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow('Complete case file upload payload missing.');
  });

  it('initiate upload should enforce a strict payload', async () => {
    // validate caseUlid
    await expect(initiateCaseFileUploadAndValidate('ABCD')).rejects.toThrow();
    await expect(initiateCaseFileUploadAndValidate('')).rejects.toThrow();

    // validate fileName
    await expect(initiateCaseFileUploadAndValidate(CASE_ULID, '')).rejects.toThrow();
    await expect(initiateCaseFileUploadAndValidate(CASE_ULID, '/food/ramen.jpg')).rejects.toThrow();
    await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'hello\0')).rejects.toThrow();

    // allowed fileNames
    expect(await initiateCaseFileUploadAndValidate(CASE_ULID, 'ramen.jpg')).toBeDefined();
    expect(await initiateCaseFileUploadAndValidate(CASE_ULID, '01234')).toBeDefined();
    expect(await initiateCaseFileUploadAndValidate(CASE_ULID, 'ramen-jpg')).toBeDefined();
    expect(await initiateCaseFileUploadAndValidate(CASE_ULID, 'ramen_jpg')).toBeDefined();
    expect(await initiateCaseFileUploadAndValidate(CASE_ULID, 'ramen jpg')).toBeDefined();

    // validate filePath
    await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, 'foo')).rejects.toThrow();
    await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, '')).rejects.toThrow();
    await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, 'foo\\')).rejects.toThrow();
    await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, 'foo&&')).rejects.toThrow();

    // allowed filePaths
    expect(await initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, '/')).toBeDefined();
    expect(await initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, '/foo/')).toBeDefined();
    expect(await initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, '/foo/bar/')).toBeDefined();

    // validate fileSizeMb
    await expect(
      initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, CONTENT_TYPE, 0)
    ).rejects.toThrow();
    await expect(
      initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, CONTENT_TYPE, -1)
    ).rejects.toThrow();
    await expect(
      initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, CONTENT_TYPE, 5_000_001)
    ).rejects.toThrow();

    // allowed fileSizeMb
    expect(
      await initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, CONTENT_TYPE, 4_999_999)
    ).toBeDefined();
    expect(
      await initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, CONTENT_TYPE, 1)
    ).toBeDefined();
  });

  it('complete upload should enforce a strict payload', async () => {
    // validate caseUlid
    await expect(completeCaseFileUploadAndValidate(FILE_ULID, 'ABCD')).rejects.toThrow();
    await expect(completeCaseFileUploadAndValidate(FILE_ULID, '')).rejects.toThrow();

    // validate fileName
    await expect(completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, '')).rejects.toThrow();
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, '/food/ramen.jpg')
    ).rejects.toThrow();
    await expect(completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, 'hello\0')).rejects.toThrow();

    // validate filePath
    await expect(completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, 'foo')).rejects.toThrow();
    await expect(completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, '')).rejects.toThrow();
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, 'foo\\')
    ).rejects.toThrow();
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, 'foo&&')
    ).rejects.toThrow();

    // validate ulid
    await expect(
      completeCaseFileUploadAndValidate('ABCD', CASE_ULID, FILE_NAME, CONTENT_TYPE)
    ).rejects.toThrow();
    await expect(completeCaseFileUploadAndValidate('', CASE_ULID, FILE_NAME, CONTENT_TYPE)).rejects.toThrow();

    // validate uploadId
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, CONTENT_TYPE, '&&')
    ).rejects.toThrow();
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, CONTENT_TYPE, '"foo"')
    ).rejects.toThrow();
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, CONTENT_TYPE, "'foo'")
    ).rejects.toThrow();
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, CONTENT_TYPE, '<food>')
    ).rejects.toThrow();

    // validate sha256Hash
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, CONTENT_TYPE, UPLOAD_ID, '')
    ).rejects.toThrow(); // empty
    await expect(
      completeCaseFileUploadAndValidate(FILE_ULID, CASE_ULID, FILE_NAME, CONTENT_TYPE, UPLOAD_ID, 'sha')
    ).rejects.toThrow(); // short
    await expect(
      completeCaseFileUploadAndValidate(
        FILE_ULID,
        CASE_ULID,
        FILE_NAME,
        CONTENT_TYPE,
        UPLOAD_ID,
        '030A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFFFF02EBE0'
      )
    ).rejects.toThrow(); // long
    await expect(
      completeCaseFileUploadAndValidate(
        FILE_ULID,
        CASE_ULID,
        FILE_NAME,
        CONTENT_TYPE,
        UPLOAD_ID,
        '&30A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFF02EBE0B'
      )
    ).rejects.toThrow(); // illegal character
  });
});

async function initiateCaseFileUploadAndValidate(
  caseUlid: string = CASE_ULID,
  fileName: string = FILE_NAME,
  filePath: string = FILE_PATH,
  contentType: string = CONTENT_TYPE,
  fileSizeMb: number = FILE_SIZE_MB
): Promise<DeaCaseFile> {
  const event = Object.assign(
    {},
    {
      ...dummyEvent,
      body: JSON.stringify({
        caseUlid,
        fileName,
        filePath,
        contentType,
        fileSizeMb,
      }),
    }
  );
  const response = await initiateCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  return validateApiResponse(response, fileName, caseUlid, filePath);
}

async function completeCaseFileUploadAndValidate(
  ulid: string = FILE_ULID,
  caseUlid: string = CASE_ULID,
  fileName: string = FILE_NAME,
  filePath: string = FILE_PATH,
  uploadId: string = UPLOAD_ID,
  sha256Hash: string = SHA256_HASH
): Promise<DeaCaseFile> {
  const event = Object.assign(
    {},
    {
      ...dummyEvent,
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
  const response = await completeCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  return validateApiResponse(response, fileName, caseUlid, filePath);
}

async function validateApiResponse(
  response: APIGatewayProxyStructuredResultV2,
  fileName: string,
  caseUlid: string,
  filePath: string
): Promise<DeaCaseFile> {
  expect(response.statusCode).toEqual(200);

  if (!response.body) {
    fail();
  }

  const newCaseFile: DeaCaseFile = JSON.parse(response.body);
  expect(newCaseFile.fileName).toEqual(fileName);
  expect(newCaseFile.caseUlid).toEqual(caseUlid);
  expect(newCaseFile.filePath).toEqual(filePath);

  return newCaseFile;
}
