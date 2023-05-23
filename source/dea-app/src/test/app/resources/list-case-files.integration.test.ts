/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import 'aws-sdk-client-mock-jest';
import { fail } from 'assert';
import { S3Client, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';

import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { getCaseFileDetails } from '../../../app/resources/get-case-file-details';
import { CaseFileStatus } from '../../../models/case-file-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  callCreateCase,
  callCreateUser,
  callInitiateCaseFileUpload,
  callListCaseFiles,
  ResponseCaseFilePage,
  validateCaseFile,
} from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let fileDescriber: DeaUser;
let caseToList = '';

const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';

jest.setTimeout(20000);

describe('Test list case files', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('ListCaseFilesTest');

    fileDescriber = await callCreateUser(repositoryProvider);

    caseToList = (await callCreateCase(fileDescriber, repositoryProvider)).ulid ?? fail();
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

  it('List case-files should successfully get case-files', async () => {
    const caseFile = await callInitiateCaseFileUpload(fileDescriber.ulid, repositoryProvider, caseToList);
    const caseFileList: ResponseCaseFilePage = await callListCaseFiles(
      fileDescriber.ulid,
      repositoryProvider,
      caseToList
    );
    expect(caseFileList.files.length).toEqual(1);
    expect(caseFileList.next).toBeUndefined();
    await validateCaseFile(
      caseFileList.files[0],
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      caseFile.ulid as string,
      caseToList,
      `${fileDescriber.firstName} ${fileDescriber.lastName}`
    );
  });

  it('List case-files should successfully get case-files with pagination', async () => {
    const filePath = '/';
    const caseFile1 = await callInitiateCaseFileUpload(
      fileDescriber.ulid,
      repositoryProvider,
      caseToList,
      'file1',
      filePath
    );
    const caseFile2 = await callInitiateCaseFileUpload(
      fileDescriber.ulid,
      repositoryProvider,
      caseToList,
      'file2',
      filePath
    );
    const caseFileList1: ResponseCaseFilePage = await callListCaseFiles(
      fileDescriber.ulid,
      repositoryProvider,
      caseToList,
      '1',
      filePath
    );
    expect(caseFileList1.files.length).toEqual(1);
    expect(caseFileList1.next).toBeDefined();

    const caseFileList2: ResponseCaseFilePage = await callListCaseFiles(
      fileDescriber.ulid,
      repositoryProvider,
      caseToList,
      '30',
      filePath,
      caseFileList1.next
    );
    expect(caseFileList2.files.length).toEqual(1);
    expect(caseFileList2.next).toBeUndefined();

    // OK to assume that casefile1 is returned before casefile2 because GSI sorts by filename
    await validateCaseFile(
      caseFileList1.files[0],
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      caseFile1.ulid as string,
      caseToList,
      `${fileDescriber.firstName} ${fileDescriber.lastName}`,
      CaseFileStatus.PENDING,
      'file1',
      filePath
    );

    await validateCaseFile(
      caseFileList2.files[0],
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      caseFile2.ulid as string,
      caseToList,
      `${fileDescriber.firstName} ${fileDescriber.lastName}`,
      CaseFileStatus.PENDING,
      'file2',
      filePath
    );
  });

  it('List case-files should successfully get case-files with no results', async () => {
    const caseFileList: ResponseCaseFilePage = await callListCaseFiles(
      fileDescriber.ulid,
      repositoryProvider,
      caseToList,
      '30',
      '/noresult/'
    );
    expect(caseFileList.files.length).toEqual(0);
    expect(caseFileList.next).toBeUndefined();
  });

  it('List case-files should throw a validation exception when case-id path param missing', async () => {
    const event = getDummyEvent({
      headers: {
        userUlid: fileDescriber.ulid,
      },
      pathParameters: {
        fileId: FILE_ULID,
      },
    });
    await expect(getCaseFileDetails(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `Required path param 'caseId' is missing.`
    );
  });

  it('List case-files should throw an exception when case does not exist in DB', async () => {
    // use a bogus ULID
    await expect(callListCaseFiles(fileDescriber.ulid, repositoryProvider, FILE_ULID)).rejects.toThrow(
      `Could not find case: ${FILE_ULID} in the DB`
    );
  });
});
