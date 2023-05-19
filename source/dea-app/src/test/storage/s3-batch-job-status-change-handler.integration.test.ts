/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { S3Client, ServiceInputTypes as S3Input, ServiceOutputTypes as S3Output } from '@aws-sdk/client-s3';
import {
  S3ControlClient,
  ServiceInputTypes as S3ControlInput,
  ServiceOutputTypes as S3ControlOutput,
} from '@aws-sdk/client-s3-control';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { v4 as uuidv4 } from 'uuid';
import { DeaCaseInput } from '../../models/case';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { DeaUser } from '../../models/user';
import { createCase, getCase, updateCaseStatus as updateCaseStatusInDb } from '../../persistence/case';
import { createJob, getJob } from '../../persistence/job';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { createUser } from '../../persistence/user';
import { deleteCaseFileHandler } from '../../storage/s3-batch-delete-case-file-handler';
import { s3BatchJobStatusChangeHandler } from '../../storage/s3-batch-job-status-change-handler';
import {
  callCompleteCaseFileUpload,
  callGetCaseFileDetails,
  callInitiateCaseFileUpload,
  callUpdateCaseStatusAndValidate,
  DATASETS_PROVIDER,
  FILE_SIZE_BYTES,
  validateCaseStatusUpdatedAsExpected,
} from '../app/resources/case-file-integration-test-helper';
import { dummyContext } from '../integration-objects';
import { getTestRepositoryProvider } from '../persistence/local-db-table';
import {
  CALLBACK_FN,
  getS3BatchDeleteCaseFileEvent,
  getS3BatchResult,
} from './s3-batch-delete-case-file-handler.integration.test';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;
let s3Mock: AwsStub<S3Input, S3Output>;
let s3ControlMock: AwsStub<S3ControlInput, S3ControlOutput>;

const ETAG = 'hehe';
const VERSION_ID = 'haha';

describe('S3 batch job status change handler', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('s3BatchStatusChangeHandler');

    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  beforeEach(() => {
    // reset mock so that each test can validate its own set of mock calls
    s3Mock = mockClient(S3Client);
    s3Mock.resolves({
      UploadId: 'lol',
      VersionId: VERSION_ID,
      ETag: ETAG,
      Parts: [
        {
          ETag: 'I am an etag',
          PartNumber: 99,
        },
      ],
    });

    s3ControlMock = mockClient(S3ControlClient);
  });

  it('should successfully update case and delete job when completed with no failures', async () => {
    const { jobId, caseId } = await setupTestEnv('happy path');

    // call lambda
    await s3BatchJobStatusChangeHandler(
      getEventBridgeEvent(jobId, 'Complete'),
      dummyContext,
      () => {
        return 'hello';
      },
      repositoryProvider
    );

    const job = await getJob(jobId, repositoryProvider);
    expect(job).toBeFalsy();

    const deletedCase = (await getCase(caseId, undefined, repositoryProvider)) ?? fail();
    expect(deletedCase.filesStatus).toEqual(CaseFileStatus.DELETED);
  });

  it('should mark as delete_failed if job complete but active files remain', async () => {
    const { jobId, caseId } = await setupTestEnv('files not deleted', false);

    // call lambda
    await s3BatchJobStatusChangeHandler(
      getEventBridgeEvent(jobId, 'Complete'),
      dummyContext,
      () => {
        return 'hello';
      },
      repositoryProvider
    );

    const job = await getJob(jobId, repositoryProvider);
    expect(job).toBeFalsy();

    const deletedCase = (await getCase(caseId, undefined, repositoryProvider)) ?? fail();
    expect(deletedCase.filesStatus).toEqual(CaseFileStatus.DELETE_FAILED);
  });

  it('should mark as delete_failed if job complete with failures', async () => {
    const { jobId, caseId } = await setupTestEnv('job failure', true, 1);

    // call lambda
    await s3BatchJobStatusChangeHandler(
      getEventBridgeEvent(jobId, 'Complete'),
      dummyContext,
      () => {
        return 'hello';
      },
      repositoryProvider
    );

    const job = await getJob(jobId, repositoryProvider);
    expect(job).toBeFalsy();

    const deletedCase = (await getCase(caseId, undefined, repositoryProvider)) ?? fail();
    expect(deletedCase.filesStatus).toEqual(CaseFileStatus.DELETE_FAILED);
  });

  it('should do nothing when case is ACTIVE', async () => {
    const { jobId, caseId } = await setupTestEnv('active case');

    const createdCase = (await getCase(caseId, undefined, repositoryProvider)) ?? fail();
    // update case status to inactive directly in DB
    await updateCaseStatusInDb(createdCase, CaseStatus.ACTIVE, CaseFileStatus.ACTIVE, repositoryProvider);

    // call lambda
    await s3BatchJobStatusChangeHandler(
      getEventBridgeEvent(jobId, 'InComplete'),
      dummyContext,
      () => {
        return 'hello';
      },
      repositoryProvider
    );

    const job = await getJob(jobId, repositoryProvider);
    expect(job).toBeTruthy();

    const deletedCase = (await getCase(caseId, undefined, repositoryProvider)) ?? fail();
    expect(deletedCase.filesStatus).toEqual(CaseFileStatus.ACTIVE);
  });

  it('should do nothing when job is not complete', async () => {
    const { jobId, caseId } = await setupTestEnv('not complete');

    // call lambda
    await s3BatchJobStatusChangeHandler(
      getEventBridgeEvent(jobId, 'InComplete'),
      dummyContext,
      () => {
        return 'hello';
      },
      repositoryProvider
    );

    const job = await getJob(jobId, repositoryProvider);
    expect(job).toBeTruthy();

    const deletedCase = (await getCase(caseId, undefined, repositoryProvider)) ?? fail();
    expect(deletedCase.filesStatus).toEqual(CaseFileStatus.DELETING);
  });

  it('should do nothing when job is not related to DEA', async () => {
    const { jobId, caseId } = await setupTestEnv('not a dea job');

    // call lambda
    await s3BatchJobStatusChangeHandler(
      getEventBridgeEvent('not a dea job id', 'Complete'),
      dummyContext,
      () => {
        return 'hello';
      },
      repositoryProvider
    );

    const job = await getJob(jobId, repositoryProvider);
    expect(job).toBeTruthy();

    const deletedCase = (await getCase(caseId, undefined, repositoryProvider)) ?? fail();
    expect(deletedCase.filesStatus).toEqual(CaseFileStatus.DELETING);
  });

  it('job not related to a case', async () => {
    const { jobId, caseId } = await setupTestEnv('corrupt job');

    const badJob = await createJob(
      {
        jobId: 'corrupt job',
        caseUlid: 'ABCDEFGHHJKKMNNPQRSTTVWXY0',
      },
      repositoryProvider
    );

    // call lambda
    await s3BatchJobStatusChangeHandler(
      getEventBridgeEvent(badJob.jobId, 'Complete'),
      dummyContext,
      () => {
        return 'hello';
      },
      repositoryProvider
    );

    const job = await getJob(jobId, repositoryProvider);
    expect(job).toBeTruthy();

    const notDeletedBadjob = await getJob(badJob.jobId, repositoryProvider);
    expect(notDeletedBadjob).toBeTruthy();

    const deletedCase = (await getCase(caseId, undefined, repositoryProvider)) ?? fail();
    expect(deletedCase.filesStatus).toEqual(CaseFileStatus.DELETING);
  });
});

async function setupTestEnv(caseName: string, callDeleteFilesLambda = true, failedTasks = 0) {
  // create case
  const theCase: DeaCaseInput = {
    name: caseName,
    description: 'description',
  };
  const createdCase = await createCase(theCase, caseOwner, repositoryProvider);
  const caseId = createdCase.ulid;

  // setup file
  let caseFile = await callInitiateCaseFileUpload(
    caseOwner.ulid,
    repositoryProvider,
    createdCase.ulid,
    'file1'
  );
  const fileId = caseFile.ulid ?? fail();
  caseFile = await callCompleteCaseFileUpload(caseOwner.ulid, repositoryProvider, fileId, createdCase.ulid);

  const jobId = uuidv4();
  s3ControlMock.resolves({
    JobId: jobId,
    Job: {
      ProgressSummary: {
        NumberOfTasksFailed: failedTasks,
      },
    },
  });

  // setup job and case in ddb
  const updatedCase = await callUpdateCaseStatusAndValidate(
    caseOwner.ulid,
    createdCase,
    true,
    CaseStatus.INACTIVE,
    repositoryProvider
  );
  await validateCaseStatusUpdatedAsExpected(
    createdCase,
    updatedCase,
    CaseStatus.INACTIVE,
    CaseFileStatus.DELETING,
    jobId,
    repositoryProvider,
    1,
    FILE_SIZE_BYTES
  );

  if (callDeleteFilesLambda) {
    // update case-file in ddb
    const deleteFileResponse = await deleteCaseFileHandler(
      getS3BatchDeleteCaseFileEvent(caseId, fileId, caseFile.versionId ?? null),
      dummyContext,
      CALLBACK_FN,
      repositoryProvider,
      DATASETS_PROVIDER
    );
    const deletedCaseFile = await callGetCaseFileDetails(caseOwner.ulid, repositoryProvider, fileId, caseId);
    const expectedResult = `Successfully deleted object: ${caseId}/${fileId}`;
    expect(deleteFileResponse).toEqual(getS3BatchResult(caseId, fileId, 'Succeeded', expectedResult));
    expect(deletedCaseFile.status).toEqual(CaseFileStatus.DELETED);
  }
  return { jobId, caseId: createdCase.ulid };
}

function getEventBridgeEvent(jobId: string, status: string) {
  return {
    detail: {
      serviceEventDetails: {
        jobId,
        status,
        jobArn: 'ss',
        jobEventId: 'sda',
        failureCodes: 'sda',
        statusChangeReason: ['sds'],
      },
    },
    id: 'fs',
    account: 'asd',
    resources: ['asd'],
    'detail-type': 'asd',
    region: 'us-east-1',
    time: 'asd',
    version: '1',
    source: 'asd',
  };
}
