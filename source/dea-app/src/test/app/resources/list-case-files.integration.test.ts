/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import 'aws-sdk-client-mock-jest';
import { fail } from 'assert';
import { S3Client, S3ClientResolvedConfig, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';
import {
  STSClient,
  STSClientResolvedConfig,
  ServiceInputTypes as STSInputs,
  ServiceOutputTypes as STSOutputs,
} from '@aws-sdk/client-sts';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { LambdaProviders } from '../../../app/resources/dea-gateway-proxy-handler';
import { getCaseFileDetails } from '../../../app/resources/get-case-file-details';
import { CaseFileStatus } from '../../../models/case-file-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
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
let testProviders: LambdaProviders;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes, S3ClientResolvedConfig>;
let stsMock: AwsStub<STSInputs, STSOutputs, STSClientResolvedConfig>;
let fileDescriber: DeaUser;
let caseToList = '';

const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';

jest.setTimeout(20000);

describe('Test list case files', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('ListCaseFilesTest');
    testProviders = createTestProvidersObject({ repositoryProvider });

    fileDescriber = await callCreateUser(testProviders);

    caseToList = (await callCreateCase(fileDescriber, testProviders)).ulid ?? fail();

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

  it('List case-files should successfully get case-files', async () => {
    const caseFile = await callInitiateCaseFileUpload(fileDescriber.ulid, testProviders, caseToList);
    const caseFileList: ResponseCaseFilePage = await callListCaseFiles(
      fileDescriber.ulid,
      testProviders,
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
      testProviders,
      caseToList,
      'file1',
      filePath
    );
    const caseFile2 = await callInitiateCaseFileUpload(
      fileDescriber.ulid,
      testProviders,
      caseToList,
      'file2',
      filePath
    );
    const caseFileList1: ResponseCaseFilePage = await callListCaseFiles(
      fileDescriber.ulid,
      testProviders,
      caseToList,
      '1',
      filePath
    );
    expect(caseFileList1.files.length).toEqual(1);
    expect(caseFileList1.next).toBeDefined();

    const caseFileList2: ResponseCaseFilePage = await callListCaseFiles(
      fileDescriber.ulid,
      testProviders,
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
      testProviders,
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
    await expect(getCaseFileDetails(event, dummyContext, testProviders)).rejects.toThrow(
      `Required path param 'caseId' is missing.`
    );
  });

  it('List case-files should throw an exception when case does not exist in DB', async () => {
    // use a bogus ULID
    await expect(callListCaseFiles(fileDescriber.ulid, testProviders, FILE_ULID)).rejects.toThrow(
      `Could not find case: ${FILE_ULID} in the DB`
    );
  });
});
