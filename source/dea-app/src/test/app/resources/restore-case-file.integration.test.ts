/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  ArchiveStatus,
  RestoreObjectCommand,
  S3Client,
  ServiceInputTypes,
  ServiceOutputTypes,
  StorageClass,
} from '@aws-sdk/client-s3';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { restoreCaseFile } from '../../../app/resources/restore-case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  callCompleteCaseFileUpload,
  callCreateCase,
  callCreateUser,
  callInitiateCaseFileUpload,
  callRestoreCaseFile,
  DATASETS_PROVIDER,
} from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let fileUploader: DeaUser;
let caseToDownloadFrom = '';

const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';

jest.setTimeout(20000);

describe('Test case file restore', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('CaseFileRestoreTest');

    fileUploader = await callCreateUser(repositoryProvider);
    caseToDownloadFrom = (await callCreateCase(fileUploader, repositoryProvider)).ulid ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should successfully restore a file', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      ArchiveStatus: ArchiveStatus.ARCHIVE_ACCESS,
    });
    const fileName = 'positive test';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    await callRestoreCaseFile(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
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
    await expect(restoreCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)).rejects.toThrow(
      `Required path param 'caseId' is missing.`
    );
  });

  it('should throw a validation exception when file-id path param missing', async () => {
    const event = Object.assign({
      headers: {
        userUlid: fileUploader.ulid,
      },
      pathParameters: {
        caseId: FILE_ULID,
      },
    });
    await expect(restoreCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER)).rejects.toThrow(
      `Required path param 'fileId' is missing.`
    );
  });

  it("should throw an exception when case-file doesn't exist", async () => {
    await expect(
      callRestoreCaseFile(fileUploader.ulid, repositoryProvider, FILE_ULID, caseToDownloadFrom)
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
      callRestoreCaseFile(fileUploader.ulid, repositoryProvider, caseFile.ulid as string, caseToDownloadFrom)
    ).rejects.toThrow(`Can't restore a file in ${CaseFileStatus.PENDING} state`);
  });

  it('should work when file is intelligent-tier: deep archived', async () => {
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
    await callRestoreCaseFile(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    expect(s3Mock).toHaveReceivedCommandTimes(RestoreObjectCommand, 1);
    expect(s3Mock).toHaveReceivedCommandWith(RestoreObjectCommand, {
      Bucket: DATASETS_PROVIDER.bucketName,
      Key: `${caseToDownloadFrom}/${caseFile.ulid}`,
      VersionId: VERSION_ID,
    });
  });

  it('should work when file is intelligent-tier: archived', async () => {
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
    await callRestoreCaseFile(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    expect(s3Mock).toHaveReceivedCommandTimes(RestoreObjectCommand, 1);
    expect(s3Mock).toHaveReceivedCommandWith(RestoreObjectCommand, {
      Bucket: DATASETS_PROVIDER.bucketName,
      Key: `${caseToDownloadFrom}/${caseFile.ulid}`,
      VersionId: VERSION_ID,
    });
  });

  it('should work when file is deep archived', async () => {
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
    await callRestoreCaseFile(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);

    expect(s3Mock).toHaveReceivedCommandTimes(RestoreObjectCommand, 1);
    expect(s3Mock).toHaveReceivedCommandWith(RestoreObjectCommand, {
      Bucket: DATASETS_PROVIDER.bucketName,
      Key: `${caseToDownloadFrom}/${caseFile.ulid}`,
      VersionId: VERSION_ID,
      RestoreRequest: {
        Days: 10,
      },
    });
  });

  it('should work when file is archived', async () => {
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
    await callRestoreCaseFile(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);

    expect(s3Mock).toHaveReceivedCommandTimes(RestoreObjectCommand, 1);
    expect(s3Mock).toHaveReceivedCommandWith(RestoreObjectCommand, {
      Bucket: DATASETS_PROVIDER.bucketName,
      Key: `${caseToDownloadFrom}/${caseFile.ulid}`,
      VersionId: VERSION_ID,
      RestoreRequest: {
        Days: 10,
      },
    });
  });

  it('should do nothing when file is being restored', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
      ArchiveStatus: ArchiveStatus.ARCHIVE_ACCESS,
      Restore: 'hello',
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
    await callRestoreCaseFile(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);

    expect(s3Mock).toHaveReceivedCommandTimes(RestoreObjectCommand, 0);
  });

  it('should do nothing when file is not archived', async () => {
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: UPLOAD_ID,
      VersionId: VERSION_ID,
    });

    const fileName = 'not archived file';
    const caseFile = await callInitiateCaseFileUpload(
      fileUploader.ulid,
      repositoryProvider,
      caseToDownloadFrom,
      fileName
    );

    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);
    await callRestoreCaseFile(fileUploader.ulid, repositoryProvider, fileId, caseToDownloadFrom);

    expect(s3Mock).toHaveReceivedCommandTimes(RestoreObjectCommand, 0);
  });
});
