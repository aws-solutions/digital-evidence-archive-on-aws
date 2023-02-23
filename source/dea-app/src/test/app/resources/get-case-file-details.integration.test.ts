/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import 'aws-sdk-client-mock-jest';
import { fail } from 'assert';
import { S3Client, ServiceInputTypes, ServiceOutputTypes } from '@aws-sdk/client-s3';

import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { getCaseFileDetails } from '../../../app/resources/get-case-file-details';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  callCreateCase,
  callCreateUser,
  callInitiateCaseFileUpload,
  callListCaseFiles,
} from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let s3Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
let fileDescriber: DeaUser;
let caseToList = '';

const FILE_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY9';
const UPLOAD_ID = '123456';
const VERSION_ID = '543210';
const EVENT = dummyEvent;

jest.setTimeout(20000);

describe('Test list case files', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('ListCaseFilesTest');

    fileDescriber = await callCreateUser(repositoryProvider);
    EVENT.headers['userUlid'] = fileDescriber.ulid;

    caseToList = (await callCreateCase(EVENT, repositoryProvider)).ulid ?? fail();
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
    await callInitiateCaseFileUpload(EVENT, repositoryProvider, caseToList);
    const response = callListCaseFiles(EVENT, repositoryProvider, caseToList);
    console.log('yolo');
    console.log(response);
  });

  it('List case-files should throw a validation exception when case-id path param missing', async () => {
    const event = Object.assign(
      {},
      {
        ...EVENT,
        pathParameters: {
          fileId: FILE_ULID,
        },
      }
    );
    await expect(getCaseFileDetails(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `Required path param 'caseId' is missing.`
    );
  });
});
