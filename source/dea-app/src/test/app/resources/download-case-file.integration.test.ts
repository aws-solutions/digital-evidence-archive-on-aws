/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  ArchiveStatus,
  S3Client,
  ServiceInputTypes,
  ServiceOutputTypes,
  StorageClass,
} from '@aws-sdk/client-s3';
import {
  STSClient,
  ServiceInputTypes as STSInputs,
  ServiceOutputTypes as STSOutputs,
} from '@aws-sdk/client-sts';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { downloadCaseFile } from '../../../app/resources/download-case-file';
import { DownloadCaseFileResult } from '../../../models/case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  callCompleteCaseFileUpload,
  callCreateCase,
  callCreateUser,
  callDownloadCaseFile,
  callInitiateCaseFileUpload,
  DATASETS_PROVIDER,
} from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let stsMock: AwsStub<STSInputs, STSOutputs>;
let fileUploader: DeaUser;
let caseToDownloadFrom = '';

const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';

jest.setTimeout(20000);

describe('Test case file download', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('CaseFileDownloadTest');

    fileUploader = await callCreateUser(repositoryProvider);
    caseToDownloadFrom = (await callCreateCase(fileUploader, repositoryProvider)).ulid ?? fail();

    stsMock = mockClient(STSClient);
    stsMock.resolves({
      Credentials: {
        AccessKeyId: 'hi',
        SecretAccessKey: 'hello',
        SessionToken: 'foo',
        Expiration: new Date(),
      },
    });
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
  });

  it('should successfully download a file', async () => {
    const fileName = 'positive test';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    await downloadCaseFileAndValidate(fileId, caseToDownloadFrom);
  });

  it('should throw a validation exception when case-id path param missing', async () => {
    const event = getDummyEvent({
      headers: {
        userUlid: fileUploader.ulid,
      },
      pathParameters: {
        fileId: FILE_ULID,
      },
    });
    await expect(
      downloadCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow(`Required path param 'caseId' is missing.`);
  });

  it('should throw a validation exception when file-id path param missing', async () => {
    const event = getDummyEvent({
      headers: {
        userUlid: fileUploader.ulid,
      },
      pathParameters: {
        caseId: FILE_ULID,
      },
    });
    await expect(
      downloadCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)
    ).rejects.toThrow(`Required path param 'fileId' is missing.`);
  });

  it("should throw an exception when case-file doesn't exist", async () => {
    await expect(
      callDownloadCaseFile(fileUploader.ulid, repositoryProvider, FILE_ULID, caseToDownloadFrom)
    ).rejects.toThrow(`Could not find file: ${FILE_ULID} in the DB`);
  });

  it("should throw an exception when case-file isn't active", async () => {
    const pendingFileName = 'downloadPendingFile';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      pendingFileName
    );

    await expect(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      callDownloadCaseFile(fileUploader.ulid, repositoryProvider, caseFile.ulid as string, caseToDownloadFrom)
    ).rejects.toThrow(`Can't download a file in ${CaseFileStatus.PENDING} state`);
  });

  it('should indicate when file is intelligent-tier: deep archived', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      ArchiveStatus: ArchiveStatus.DEEP_ARCHIVE_ACCESS,
    });

    const fileName = 'IT deep archived file';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    const downloadResult = await downloadCaseFileAndValidate(fileId, caseToDownloadFrom);
    expect(downloadResult.downloadUrl).toBeFalsy();
    expect(downloadResult.isRestoring).toBeFalsy();
    expect(downloadResult.isArchived).toBeTruthy();
  });

  it('should indicate when file is intelligent-tier: archived', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      ArchiveStatus: ArchiveStatus.ARCHIVE_ACCESS,
    });

    const fileName = 'IT archived file';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    const downloadResult = await downloadCaseFileAndValidate(fileId, caseToDownloadFrom);
    expect(downloadResult.downloadUrl).toBeFalsy();
    expect(downloadResult.isRestoring).toBeFalsy();
    expect(downloadResult.isArchived).toBeTruthy();
  });

  it('should indicate when file is deep archived', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      StorageClass: StorageClass.DEEP_ARCHIVE,
    });

    const fileName = 'deep archived file';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    const downloadResult = await downloadCaseFileAndValidate(fileId, caseToDownloadFrom);
    expect(downloadResult.downloadUrl).toBeFalsy();
    expect(downloadResult.isRestoring).toBeFalsy();
    expect(downloadResult.isArchived).toBeTruthy();
  });

  it('should indicate when file is archived', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      StorageClass: StorageClass.GLACIER,
    });

    const fileName = 'archived file';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    const downloadResult = await downloadCaseFileAndValidate(fileId, caseToDownloadFrom);
    expect(downloadResult.downloadUrl).toBeFalsy();
    expect(downloadResult.isRestoring).toBeFalsy();
    expect(downloadResult.isArchived).toBeTruthy();
  });

  it('should indicate when file is being restored', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      ArchiveStatus: ArchiveStatus.ARCHIVE_ACCESS,
      Restore: 'ongoing-request="true"',
    });

    const fileName = 'restoring file';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    const downloadResult = await downloadCaseFileAndValidate(fileId, caseToDownloadFrom);
    expect(downloadResult.downloadUrl).toBeFalsy();
    expect(downloadResult.isRestoring).toBeTruthy();
    expect(downloadResult.isArchived).toBeTruthy();
  });

  it('should work when archived file is restored', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      ArchiveStatus: ArchiveStatus.ARCHIVE_ACCESS,
      Restore: 'ongoing-request="false"',
    });

    const fileName = 'restored file';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    const downloadResult = await downloadCaseFileAndValidate(fileId, caseToDownloadFrom);
    expect(downloadResult.downloadUrl).toBeTruthy();
    expect(downloadResult.isRestoring).toBeFalsy();
    expect(downloadResult.isArchived).toBeTruthy();
  });
});

async function downloadCaseFileAndValidate(fileId: string, caseId: string): Promise<DownloadCaseFileResult> {
  const result = await callDownloadCaseFile(fileUploader.ulid, repositoryProvider, fileId, caseId);
  if (result.downloadUrl) {
    expect(result.downloadUrl).toContain(
      `https://s3.us-east-1.amazonaws.com/${DATASETS_PROVIDER.bucketName}`
    );
  }
  return result;
}
