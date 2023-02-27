/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import 'aws-sdk-client-mock-jest';
import { fail } from 'assert';
import { S3Client, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { downloadCaseFile } from '../../../app/resources/download-case-file';
import { DeaCaseFile } from '../../../models/case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  callCompleteCaseFileUpload,
  callCreateCase,
  callCreateUser,
  callDownloadCaseFile,
  callInitiateCaseFileUpload,
} from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let fileUploader: DeaUser;
let caseToDownloadFrom = '';

const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';
const DATASETS_PROVIDER = {
  s3Client: new S3Client({ region: 'us-east-1' }),
  bucketName: 'testBucket',
  chunkSizeMB: 500,
  presignedCommandExpirySeconds: 3600,
};

const EVENT = dummyEvent;

jest.setTimeout(20000);

describe('Test case file download', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('CaseFileDownloadTest');

    fileUploader = await callCreateUser(repositoryProvider);
    EVENT.headers['userUlid'] = fileUploader.ulid;
    caseToDownloadFrom = (await callCreateCase(fileUploader, repositoryProvider)).ulid ?? fail();
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

  it('should successfully download a file', async () => {
    const fileName = 'positive test';
    const caseFile: DeaCaseFile = await callInitiateCaseFileUpload(
      EVENT,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fileId = caseFile.ulid as string;
    await callCompleteCaseFileUpload(EVENT, repositoryProvider, fileId, caseToDownloadFrom);
    await downloadCaseFileAndValidate(fileId, caseToDownloadFrom);
  });

  it('download should throw a validation exception when case-id path param missing', async () => {
    const event = Object.assign(
      {},
      {
        ...EVENT,
        pathParameters: {
          fileId: FILE_ULID,
        },
      }
    );
    await expect(
      downloadCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow(`Required path param 'caseId' is missing.`);
  });

  it('download should throw a validation exception when file-id path param missing', async () => {
    const event = Object.assign(
      {},
      {
        ...EVENT,
        pathParameters: {
          caseId: FILE_ULID,
        },
      }
    );
    await expect(
      downloadCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow(`Required path param 'fileId' is missing.`);
  });

  it("download should throw an exception when case-file doesn't exist", async () => {
    await expect(
      callDownloadCaseFile(EVENT, repositoryProvider, FILE_ULID, caseToDownloadFrom)
    ).rejects.toThrow(`Could not find file: ${FILE_ULID} in the DB`);
  });

  it("download should throw an exception when case-file isn't active", async () => {
    const pendingFileName = 'downloadPendingFile';
    const caseFile: DeaCaseFile = await callInitiateCaseFileUpload(
      EVENT,
      repositoryProvider,
      caseToDownloadFrom,
      pendingFileName
    );

    await expect(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      callDownloadCaseFile(EVENT, repositoryProvider, caseFile.ulid as string, caseToDownloadFrom)
    ).rejects.toThrow(`Can't download a file in ${CaseFileStatus.PENDING} state`);
  });
});

async function downloadCaseFileAndValidate(fileId: string, caseId: string): Promise<string> {
  const presignedUrl = await callDownloadCaseFile(EVENT, repositoryProvider, fileId, caseId);
  expect(presignedUrl).toContain(`https://s3.us-east-1.amazonaws.com/${DATASETS_PROVIDER.bucketName}`);
  return presignedUrl;
}
