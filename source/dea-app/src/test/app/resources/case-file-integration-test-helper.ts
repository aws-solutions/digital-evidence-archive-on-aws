/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { S3Client } from '@aws-sdk/client-s3';
import { S3ControlClient } from '@aws-sdk/client-s3-control';
import { APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { completeCaseFileUpload } from '../../../app/resources/complete-case-file-upload';
import { downloadCaseFile } from '../../../app/resources/download-case-file';
import { getCaseFileDetails } from '../../../app/resources/get-case-file-details';
import { initiateCaseFileUpload } from '../../../app/resources/initiate-case-file-upload';
import { listCaseFiles } from '../../../app/resources/list-case-files';
import { restoreCaseFile } from '../../../app/resources/restore-case-file';
import { updateCaseStatus } from '../../../app/resources/update-case-status';
import * as CaseService from '../../../app/services/case-service';
import { DeaCase } from '../../../models/case';
import {
  CaseFileDTO,
  DeaCaseFile,
  DeaCaseFileResult,
  DeaCaseFileUpload,
  DownloadCaseFileResult,
} from '../../../models/case-file';
import { CaseFileStatus } from '../../../models/case-file-status';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { caseResponseSchema } from '../../../models/validation/case';
import { ONE_MB } from '../../../models/validation/joi-common';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { getJob } from '../../../persistence/job';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { testEnv } from '../../../test-e2e/helpers/settings';
import { dummyContext, getDummyEvent } from '../../integration-objects';

export type ResponseCaseFilePage = {
  files: CaseFileDTO[];
  next: string | undefined;
};

const TOKEN_ID = 'CaseFile';
const ID_POOL_ID = 'CaseFileIdentityId';
const FIRST_NAME = 'CASE';
const LAST_NAME = 'FILE';
const CASE_NAME = 'Dinner';
const CASE_DESCRIPTION = 'Yummy';
const FILE_NAME = 'tuna.jpeg';
const FILE_PATH = '/food/sushi/';
export const FILE_SIZE_BYTES = 50;
export const CHUNK_SIZE_BYTES = 499 * ONE_MB;
const CONTENT_TYPE = 'image/jpeg';
const REASON = 'none';
const DETAILS = 'hungry';
export const DATASETS_PROVIDER = {
  s3Client: new S3Client({ region: testEnv.awsRegion }),
  s3ControlClient: new S3ControlClient({ region: testEnv.awsRegion }),
  bucketName: 'testBucket',
  uploadPresignedCommandExpirySeconds: 3600,
  downloadPresignedCommandExpirySeconds: 900,
  deletionAllowed: true,
  s3BatchDeleteCaseFileLambdaArn: 'arn:aws:lambda:us-east-1:1234:function:foo',
  s3BatchDeleteCaseFileRole: 'arn:aws:iam::1234:role/foo',
  sourceIpValidationEnabled: true,
  endUserUploadRole: 'arn:aws:iam:1234:role/baz',
  datasetsRole: 'arn:aws:iam::1234:role/bar',
  awsPartition: 'aws',
  checksumQueueUrl: 'checksumQueueUrl',
};

jest.setTimeout(20000);

export const callInitiateCaseFileUpload = async (
  uploaderId: string | undefined,
  repositoryProvider: ModelRepositoryProvider,
  caseUlid: string,
  fileName = FILE_NAME,
  filePath = FILE_PATH,
  contentType = CONTENT_TYPE,
  fileSizeBytes = FILE_SIZE_BYTES,
  reason = REASON,
  details = DETAILS,
  chunkSizeBytes = CHUNK_SIZE_BYTES
): Promise<DeaCaseFileUpload> => {
  process.env.SOURCE_IP_MASK_CIDR = '32';
  const event = getDummyEvent({
    headers: {
      userUlid: uploaderId,
    },
    pathParameters: {
      caseId: caseUlid,
    },
    body: JSON.stringify({
      caseUlid,
      fileName,
      filePath,
      contentType,
      fileSizeBytes,
      reason,
      details,
      chunkSizeBytes,
    }),
  });
  const response = await initiateCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  checkApiSucceeded(response);
  return JSON.parse(response.body);
};

export const callCompleteCaseFileUpload = async (
  uploaderId: string | undefined,
  repositoryProvider: ModelRepositoryProvider,
  ulid: string,
  caseUlid: string
): Promise<DeaCaseFileResult> => {
  const event = getDummyEvent({
    headers: {
      userUlid: uploaderId,
    },
    pathParameters: {
      caseId: caseUlid,
      fileId: ulid,
    },
    body: JSON.stringify({
      caseUlid,
      ulid,
    }),
  });
  const response = await completeCaseFileUpload(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);

  checkApiSucceeded(response);
  return JSON.parse(response.body);
};

export const callDownloadCaseFile = async (
  requesterUlid: string | undefined,
  repositoryProvider: ModelRepositoryProvider,
  fileId: string,
  caseId: string,
  reason = 'no test reason specified'
): Promise<DownloadCaseFileResult> => {
  const event = getDummyEvent({
    headers: {
      userUlid: requesterUlid,
    },
    pathParameters: {
      caseId,
      fileId,
    },
    body: JSON.stringify({
      caseUlid: caseId,
      ulid: fileId,
      downloadReason: reason,
    }),
  });
  const response = await downloadCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  checkApiSucceeded(response);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(response.body as string) ?? fail();
};

export const callRestoreCaseFile = async (
  requesterUlid: string | undefined,
  repositoryProvider: ModelRepositoryProvider,
  fileId: string,
  caseId: string
): Promise<void> => {
  const event = getDummyEvent({
    headers: {
      userUlid: requesterUlid,
    },
    pathParameters: {
      caseId,
      fileId,
    },
  });
  const response = await restoreCaseFile(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  expect(response.statusCode).toEqual(204);
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
  requesterUlid: string | undefined,
  repositoryProvider: ModelRepositoryProvider,
  fileId: string,
  caseId: string
): Promise<CaseFileDTO> => {
  const event = getDummyEvent({
    headers: {
      userUlid: requesterUlid,
    },
    pathParameters: {
      caseId,
      fileId,
    },
  });
  const response = await getCaseFileDetails(event, dummyContext, repositoryProvider, DATASETS_PROVIDER);
  checkApiSucceeded(response);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return JSON.parse(response.body as string);
};

export const callListCaseFiles = async (
  requesterUlid: string | undefined,
  repositoryProvider: ModelRepositoryProvider,
  caseId: string,
  limit = '30',
  filePath: string = FILE_PATH,
  next?: string
): Promise<ResponseCaseFilePage> => {
  const event = getDummyEvent({
    headers: {
      userUlid: requesterUlid,
    },
    pathParameters: {
      caseId,
    },
    queryStringParameters: {
      limit,
      filePath,
      next,
    },
  });
  const response = await listCaseFiles(event, dummyContext, repositoryProvider);
  checkApiSucceeded(response);
  return JSON.parse(response.body);
};

export const callCreateUser = async (
  repositoryProvider: ModelRepositoryProvider,
  tokenId: string = TOKEN_ID,
  idPoolId: string = ID_POOL_ID,
  firstName: string = FIRST_NAME,
  lastName: string = LAST_NAME
): Promise<DeaUser> => {
  return createUser(
    {
      tokenId,
      idPoolId,
      firstName,
      lastName,
    },
    repositoryProvider
  );
};

export const callUpdateCaseStatusAndValidate = async (
  requesterUlid: string | undefined,
  createdCase: DeaCase,
  deleteFiles: boolean,
  status: CaseStatus,
  repositoryProvider: ModelRepositoryProvider,
  datasetsProvider = DATASETS_PROVIDER
): Promise<DeaCase> => {
  const event = getDummyEvent({
    headers: {
      userUlid: requesterUlid,
    },
    pathParameters: {
      caseId: createdCase.ulid,
    },
    body: JSON.stringify({
      name: createdCase.name,
      deleteFiles,
      status,
    }),
  });
  const response = await updateCaseStatus(event, dummyContext, repositoryProvider, datasetsProvider);
  checkApiSucceeded(response);

  const updatedCase: DeaCase = jsonParseWithDates(response.body);
  Joi.assert(updatedCase, caseResponseSchema);

  return updatedCase;
};

export async function validateCaseStatusUpdatedAsExpected(
  createdCase: DeaCase,
  updatedCase: DeaCase,
  status: CaseStatus,
  filesStatus: CaseFileStatus,
  s3BatchJobId: string | undefined,
  repositoryProvider: ModelRepositoryProvider,
  objectCount = 0,
  totalSizeBytes = 0
) {
  if (!updatedCase.updated || !createdCase.updated) {
    fail();
  }

  expect(updatedCase.updated.getTime()).toBeGreaterThan(createdCase.updated.getTime());

  expect(updatedCase).toEqual({
    ...createdCase,
    updated: updatedCase.updated,
    status,
    filesStatus,
    s3BatchJobId,
    objectCount,
    totalSizeBytes,
  });

  if (s3BatchJobId) {
    const job = await getJob(s3BatchJobId, repositoryProvider);
    if (!job) {
      fail();
    }
    expect(job.jobId).toEqual(s3BatchJobId);
    expect(job?.caseUlid).toEqual(createdCase.ulid);
  }
}

export const checkApiSucceeded = (response: APIGatewayProxyResult) => {
  expect(response.statusCode).toEqual(200);

  if (!response.body) {
    fail();
  }
};

export const validateCaseFile = async (
  deaCaseFile: DeaCaseFile | CaseFileDTO,
  expectedfileId: string,
  expectedCaseId: string,
  expectedCreator = `${FIRST_NAME} ${LAST_NAME}`,
  expectedStatus = CaseFileStatus.PENDING,
  expectedFileName = FILE_NAME,
  expectedFilePath = FILE_PATH,
  expectedContentType = CONTENT_TYPE,
  expectedFileSizeBytes = FILE_SIZE_BYTES,
  expectedReason = REASON,
  expectedDetails = DETAILS
): Promise<void> => {
  expect(deaCaseFile.ulid).toEqual(expectedfileId);
  expect(deaCaseFile.isFile).toEqual(true);
  expect(deaCaseFile.status).toEqual(expectedStatus);
  expect(deaCaseFile.contentType).toEqual(expectedContentType);
  expect(deaCaseFile.fileName).toEqual(expectedFileName);
  expect(deaCaseFile.filePath).toEqual(expectedFilePath);
  expect(deaCaseFile.createdBy).toEqual(expectedCreator);
  expect(deaCaseFile.fileSizeBytes).toEqual(expectedFileSizeBytes);
  expect(deaCaseFile.details).toEqual(expectedDetails);
  expect(deaCaseFile.reason).toEqual(expectedReason);
};
