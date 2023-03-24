/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { S3Client } from '@aws-sdk/client-s3';
import { APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda';
import { completeCaseFileUpload } from '../../../app/resources/complete-case-file-upload';
import { downloadCaseFile } from '../../../app/resources/download-case-file';
import { getCaseFileDetails } from '../../../app/resources/get-case-file-details';
import { initiateCaseFileUpload } from '../../../app/resources/initiate-case-file-upload';
import { listCaseFiles } from '../../../app/resources/list-case-files';
import * as CaseService from '../../../app/services/case-service';
import { DeaCase } from '../../../models/case';
import { DeaCaseFile } from '../../../models/case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext } from '../../integration-objects';

export type ResponseCaseFilePage = {
  cases: DeaCaseFile[];
  next: string | undefined;
};

const TOKEN_ID = 'CaseFile';
const FIRST_NAME = 'CASE';
const LAST_NAME = 'FILE';
const CASE_NAME = 'Dinner';
const CASE_DESCRIPTION = 'Yummy';
const FILE_NAME = 'tuna.jpeg';
const USER_ULID = 'ABCDEFGHHJKKMNNPQRSTTVWXY0';
const FILE_PATH = '/food/sushi/';
const SHA256_HASH = '030A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFF02EBE0B';
const FILE_SIZE_MB = 50;
export const CHUNK_SIZE_MB = 500;
const CONTENT_TYPE = 'image/jpeg';
const REASON = 'none';
const TAG = 'yum';
const DETAILS = 'hungry';
export const DATASETS_PROVIDER = {
  s3Client: new S3Client({ region: 'us-east-1' }),
  bucketName: 'testBucket',
  presignedCommandExpirySeconds: 3600,
};

jest.setTimeout(20000);

export const callInitiateCaseFileUpload = async (
  baseEvent: APIGatewayProxyEvent,
  repositoryProvider: ModelRepositoryProvider,
  caseUlid: string,
  fileName = FILE_NAME,
  filePath = FILE_PATH,
  contentType = CONTENT_TYPE,
  fileSizeMb = FILE_SIZE_MB,
  tag = TAG,
  reason = REASON,
  details = DETAILS,
  chunkSizeMb = CHUNK_SIZE_MB
): Promise<DeaCaseFile> => {
  const event = Object.assign(
    {},
    {
      ...baseEvent,
      body: JSON.stringify({
        caseUlid,
        fileName,
        filePath,
        contentType,
        fileSizeMb,
        tag,
        reason,
        details,
        chunkSizeMb,
      }),
    }
  );
  const response = await initiateCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  await checkApiSucceeded(response);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(response.body as string);
};

export const callCompleteCaseFileUpload = async (
  baseEvent: APIGatewayProxyEvent,
  repositoryProvider: ModelRepositoryProvider,
  ulid: string,
  caseUlid: string,
  sha256Hash: string = SHA256_HASH
): Promise<DeaCaseFile> => {
  const event = Object.assign(
    {},
    {
      ...baseEvent,
      body: JSON.stringify({
        caseUlid,
        sha256Hash,
        ulid,
      }),
    }
  );
  const response = await completeCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);

  await checkApiSucceeded(response);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(response.body as string);
};

export const callDownloadCaseFile = async (
  baseEvent: APIGatewayProxyEvent,
  repositoryProvider: ModelRepositoryProvider,
  fileId: string,
  caseId: string
): Promise<string> => {
  const event = Object.assign(
    {},
    {
      ...baseEvent,
      pathParameters: {
        caseId,
        fileId,
      },
    }
  );
  const response = await downloadCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  await checkApiSucceeded(response);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(response.body as string).downloadUrl ?? fail();
};

export const callCreateCase = async (
  owner: DeaUser,
  repositoryProvider: ModelRepositoryProvider,
  name: string = CASE_NAME,
  description: string = CASE_DESCRIPTION,
  status = CaseStatus.ACTIVE
): Promise<DeaCase> => {
  const theCase = await CaseService.createCases({ name, description }, owner, repositoryProvider);
  if (status == CaseStatus.INACTIVE) {
    const updatedCase = Object.assign(
      {},
      {
        ...theCase,
        status: CaseStatus.INACTIVE,
      }
    );
    return await CaseService.updateCases(updatedCase, repositoryProvider);
  }
  return theCase;
};

export const callGetCaseFileDetails = async (
  baseEvent: APIGatewayProxyEvent,
  repositoryProvider: ModelRepositoryProvider,
  fileId: string,
  caseId: string
): Promise<DeaCaseFile> => {
  const event = Object.assign(
    {},
    {
      ...baseEvent,
      pathParameters: {
        caseId,
        fileId,
      },
    }
  );
  const response = await getCaseFileDetails(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  await checkApiSucceeded(response);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(response.body as string);
};

export const callListCaseFiles = async (
  baseEvent: APIGatewayProxyEvent,
  repositoryProvider: ModelRepositoryProvider,
  caseId: string,
  limit = '30',
  filePath: string = FILE_PATH,
  next?: string
): Promise<ResponseCaseFilePage> => {
  const event = Object.assign(
    {},
    {
      ...baseEvent,
      pathParameters: {
        caseId,
      },
      queryStringParameters: {
        limit,
        filePath,
        next,
      },
    }
  );
  const response = await listCaseFiles(event, dummyContext, repositoryProvider);
  await checkApiSucceeded(response);
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(response.body as string);
};

export const callCreateUser = async (
  repositoryProvider: ModelRepositoryProvider,
  tokenId: string = TOKEN_ID,
  firstName: string = FIRST_NAME,
  lastName: string = LAST_NAME
): Promise<DeaUser> => {
  return createUser(
    {
      tokenId,
      firstName,
      lastName,
    },
    repositoryProvider
  );
};

async function checkApiSucceeded(response: APIGatewayProxyResult): Promise<void> {
  expect(response.statusCode).toEqual(200);

  if (!response.body) {
    fail();
  }
}

export const validateCaseFile = async (
  deaCaseFile: DeaCaseFile,
  expectedfileId: string,
  expectedCaseId: string,
  expectedCreator: string = USER_ULID,
  expectedStatus: string = CaseFileStatus.PENDING,
  expectedFileName: string = FILE_NAME,
  expectedFilePath: string = FILE_PATH,
  expectedContentType: string = CONTENT_TYPE,
  expectedFileSizeMb: number = FILE_SIZE_MB,
  expectedTag: string = TAG,
  expectedReason: string = REASON,
  expectedDetails: string = DETAILS
): Promise<void> => {
  expect(deaCaseFile.ulid).toEqual(expectedfileId);
  expect(deaCaseFile.isFile).toEqual(true);
  expect(deaCaseFile.status).toEqual(expectedStatus);
  expect(deaCaseFile.contentType).toEqual(expectedContentType);
  expect(deaCaseFile.fileName).toEqual(expectedFileName);
  expect(deaCaseFile.filePath).toEqual(expectedFilePath);
  expect(deaCaseFile.createdBy).toEqual(expectedCreator);
  expect(deaCaseFile.fileSizeMb).toEqual(expectedFileSizeMb);
  expect(deaCaseFile.tag).toEqual(expectedTag);
  expect(deaCaseFile.details).toEqual(expectedDetails);
  expect(deaCaseFile.reason).toEqual(expectedReason);
};
