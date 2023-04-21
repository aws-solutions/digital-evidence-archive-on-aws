/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  S3Client,
  ServiceInputTypes as S3Input,
  ServiceOutputTypes as S3Output,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import {
  S3ControlClient,
  ServiceInputTypes as S3ControlInput,
  ServiceOutputTypes as S3ControlOutput,
  CreateJobCommand,
  JobReportScope,
} from '@aws-sdk/client-s3-control';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { v4 as uuidv4 } from 'uuid';
import { updateCaseStatus } from '../../../app/resources/update-case-status';
import { DeaCaseInput } from '../../../models/case';
import { CaseFileStatus } from '../../../models/case-file-status';
import { CaseStatus } from '../../../models/case-status';
import { DeaUser } from '../../../models/user';
import { createCase, getCase, updateCaseStatus as updateCaseStatusInDb } from '../../../persistence/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import {
  callCompleteCaseFileUpload,
  callInitiateCaseFileUpload,
  callUpdateCaseStatusAndValidate,
  DATASETS_PROVIDER,
  FILE_SIZE_BYTES,
  validateCaseStatusUpdatedAsExpected,
} from './case-file-integration-test-helper';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;
let s3Mock: AwsStub<S3Input, S3Output>;
let s3ControlMock: AwsStub<S3ControlInput, S3ControlOutput>;

const EVENT = getDummyEvent();
const ETAG = 'hehe';
const VERSION_ID = 'haha';

describe('update case status', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('updateCaseStatus');
    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();
    EVENT.headers['userUlid'] = caseOwner.ulid;
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

  it('should successfully inactivate case and create delete batch job', async () => {
    const theCase: DeaCaseInput = {
      name: 'ACaseForUpdating',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const caseFile = await callInitiateCaseFileUpload(EVENT, repositoryProvider, createdCase.ulid, 'file1');
    await callCompleteCaseFileUpload(EVENT, repositoryProvider, caseFile.ulid ?? fail(), createdCase.ulid);

    const jobId = uuidv4();
    s3ControlMock.resolves({
      JobId: jobId,
    });

    const updatedCase = await callUpdateCaseStatusAndValidate(
      EVENT,
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

    validateS3Mocks(createdCase.ulid, caseFile.ulid);
    validateS3ControlMocks();
  });

  it('delete should succeed with no files to delete', async () => {
    const theCase: DeaCaseInput = {
      name: 'no files to delete',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);
    const updatedCase = await callUpdateCaseStatusAndValidate(
      EVENT,
      createdCase,
      true,
      CaseStatus.INACTIVE,
      repositoryProvider
    );

    await validateCaseStatusUpdatedAsExpected(
      createdCase,
      updatedCase,
      CaseStatus.INACTIVE,
      CaseFileStatus.DELETED,
      undefined,
      repositoryProvider
    );

    //ensure no job was created
    expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 0);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });

  it('should activate inactive case', async () => {
    const theCase: DeaCaseInput = {
      name: 'InactiveToActive',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    // update case status to inactive directly in DB
    await updateCaseStatusInDb(createdCase, CaseStatus.INACTIVE, CaseFileStatus.DELETED, repositoryProvider);

    const updatedCase = await callUpdateCaseStatusAndValidate(
      EVENT,
      createdCase,
      false,
      CaseStatus.ACTIVE,
      repositoryProvider
    );

    await validateCaseStatusUpdatedAsExpected(
      createdCase,
      updatedCase,
      CaseStatus.ACTIVE,
      CaseFileStatus.ACTIVE,
      undefined,
      repositoryProvider
    );

    //ensure no job was created
    expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 0);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });

  it('should not activate case that is deleting files', async () => {
    const theCase: DeaCaseInput = {
      name: 'ActivateFailWhenDeleting',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);
    const caseFile = await callInitiateCaseFileUpload(EVENT, repositoryProvider, createdCase.ulid, 'file1');
    await callCompleteCaseFileUpload(EVENT, repositoryProvider, caseFile.ulid ?? fail(), createdCase.ulid);

    const jobId = uuidv4();
    s3ControlMock.resolves({
      JobId: jobId,
    });

    const inactivatedCase = await callUpdateCaseStatusAndValidate(
      EVENT,
      createdCase,
      true,
      CaseStatus.INACTIVE,
      repositoryProvider
    );
    await validateCaseStatusUpdatedAsExpected(
      createdCase,
      inactivatedCase,
      CaseStatus.INACTIVE,
      CaseFileStatus.DELETING,
      jobId,
      repositoryProvider,
      1,
      FILE_SIZE_BYTES
    );

    await expect(
      callUpdateCaseStatusAndValidate(EVENT, inactivatedCase, false, CaseStatus.ACTIVE, repositoryProvider)
    ).rejects.toThrow("Case status can't be changed to ACTIVE when its files are being deleted");
  });

  it('is idempotent inactive to inactive', async () => {
    const theCase: DeaCaseInput = {
      name: 'ACaseForTestingDeleteIdempotency',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const updatedCase = await callUpdateCaseStatusAndValidate(
      EVENT,
      createdCase,
      true,
      CaseStatus.INACTIVE,
      repositoryProvider
    );

    // update case status again. expect case without updates
    const notUpdatedCase = await callUpdateCaseStatusAndValidate(
      EVENT,
      createdCase,
      true,
      CaseStatus.INACTIVE,
      repositoryProvider
    );

    // validate that both updated and 'notUpdated' cases are as expected and newer than created case
    await validateCaseStatusUpdatedAsExpected(
      createdCase,
      updatedCase,
      CaseStatus.INACTIVE,
      CaseFileStatus.DELETED,
      undefined,
      repositoryProvider
    );
    await validateCaseStatusUpdatedAsExpected(
      createdCase,
      notUpdatedCase,
      CaseStatus.INACTIVE,
      CaseFileStatus.DELETED,
      undefined,
      repositoryProvider
    );

    if (!updatedCase.updated || !notUpdatedCase.updated) {
      fail();
    }

    // make sure case wasn't updated second time
    expect(notUpdatedCase.updated.getTime()).not.toBeGreaterThan(updatedCase.updated.getTime());
    expect(updatedCase.updated.getTime()).toBeCloseTo(notUpdatedCase.updated.getTime());

    //ensure no job was created
    expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 0);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });

  it('No op when requesting to activate active case', async () => {
    const theCase: DeaCaseInput = {
      name: 'ACaseForTestingNoOp',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const notUpdatedCase = await callUpdateCaseStatusAndValidate(
      EVENT,
      createdCase,
      false,
      CaseStatus.ACTIVE,
      repositoryProvider
    );

    if (!createdCase.updated || !notUpdatedCase.updated) {
      fail();
    }

    // make sure case wasn't updated
    expect(notUpdatedCase.updated.getTime()).not.toBeGreaterThan(createdCase.updated.getTime());
    expect(notUpdatedCase.updated.getTime()).toBeCloseTo(createdCase.updated.getTime());

    //ensure no job was created
    expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 0);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });

  it('should fail if delete-file requested when activating case', async () => {
    const theCase: DeaCaseInput = {
      name: 'Failed delete case',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    await expect(
      callUpdateCaseStatusAndValidate(EVENT, createdCase, true, CaseStatus.ACTIVE, repositoryProvider)
    ).rejects.toThrow('Delete files can only be requested when inactivating a case');

    //ensure no job was created
    expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 0);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });

  it('should update filesStatus to DELETE_FAILED when it fails to create manifest', async () => {
    const theCase: DeaCaseInput = {
      name: 'no etag returned',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const caseFile = await callInitiateCaseFileUpload(EVENT, repositoryProvider, createdCase.ulid, 'file1');
    await callCompleteCaseFileUpload(EVENT, repositoryProvider, caseFile.ulid ?? fail(), createdCase.ulid);

    s3Mock.resolves({
      ETag: undefined,
    });
    await expect(
      callUpdateCaseStatusAndValidate(EVENT, createdCase, true, CaseStatus.INACTIVE, repositoryProvider)
    ).rejects.toThrow('Failed to delete files. Please retry.');

    const updatedCase = (await getCase(createdCase.ulid, undefined, repositoryProvider)) ?? fail();
    await validateCaseStatusUpdatedAsExpected(
      createdCase,
      updatedCase,
      CaseStatus.INACTIVE,
      CaseFileStatus.DELETE_FAILED,
      undefined,
      repositoryProvider,
      1,
      FILE_SIZE_BYTES
    );

    validateS3Mocks(createdCase.ulid, caseFile.ulid);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });

  it('should update filesStatus to DELETE_FAILED when it fails to create delete batch job', async () => {
    const theCase: DeaCaseInput = {
      name: 'no jobId returned',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);

    const caseFile = await callInitiateCaseFileUpload(EVENT, repositoryProvider, createdCase.ulid, 'file1');
    await callCompleteCaseFileUpload(EVENT, repositoryProvider, caseFile.ulid ?? fail(), createdCase.ulid);

    s3ControlMock.resolves({
      JobId: undefined,
    });
    await expect(
      callUpdateCaseStatusAndValidate(EVENT, createdCase, true, CaseStatus.INACTIVE, repositoryProvider)
    ).rejects.toThrow('Failed to delete files. Please retry.');

    const updatedCase = (await getCase(createdCase.ulid, undefined, repositoryProvider)) ?? fail();
    await validateCaseStatusUpdatedAsExpected(
      createdCase,
      updatedCase,
      CaseStatus.INACTIVE,
      CaseFileStatus.DELETE_FAILED,
      undefined,
      repositoryProvider,
      1,
      FILE_SIZE_BYTES
    );

    validateS3Mocks(createdCase.ulid, caseFile.ulid);
    validateS3ControlMocks();
  });

  it('should error if no payload is provided', async () => {
    const event = getDummyEvent({
      pathParameters: {
        caseId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      },
      body: null,
    });

    await expect(updateCaseStatus(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Update case status payload missing.'
    );

    //ensure no job was created
    expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 0);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });

  it('should error if caseId is not provided', async () => {
    const event = getDummyEvent({
      body: JSON.stringify({
        name: 'hello',
        deleteFiles: true,
        status: CaseStatus.INACTIVE,
      }),
    });

    await expect(updateCaseStatus(event, dummyContext, repositoryProvider)).rejects.toThrow(
      "Required path param 'caseId' is missing."
    );

    //ensure no job was created
    expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 0);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });

  it('should error if caseId does not exist in DB', async () => {
    const ulid = 'FAKEZ3NDEKTSV4RRFFQ69G5FAV';
    const event = getDummyEvent({
      pathParameters: {
        caseId: ulid,
      },
      body: JSON.stringify({
        name: 'hello',
        deleteFiles: true,
        status: CaseStatus.INACTIVE,
      }),
    });

    await expect(updateCaseStatus(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Could not find case: hello'
    );

    //ensure no job was created
    expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 0);
    expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 0);
  });
});

function validateS3Mocks(caseId: string, fileId?: string) {
  expect(s3Mock).toHaveReceivedCommandTimes(PutObjectCommand, 1);
  expect(s3Mock).toHaveReceivedCommandWith(PutObjectCommand, {
    Bucket: DATASETS_PROVIDER.bucketName,
    Body: `${DATASETS_PROVIDER.bucketName},${caseId}/${fileId},${VERSION_ID}`,
  });
}

function validateS3ControlMocks() {
  expect(s3ControlMock).toHaveReceivedCommandTimes(CreateJobCommand, 1);
  expect(s3ControlMock).toHaveReceivedCommandWith(CreateJobCommand, {
    ConfirmationRequired: false,
    RoleArn: DATASETS_PROVIDER.s3BatchDeleteCaseFileRole,
    Priority: 1,
    Operation: {
      LambdaInvoke: {
        FunctionArn: DATASETS_PROVIDER.s3BatchDeleteCaseFileLambdaArn,
      },
    },
    Report: {
      Enabled: true,
      Bucket: `arn:aws:s3:::${DATASETS_PROVIDER.bucketName}`,
      Prefix: 'reports',
      Format: 'Report_CSV_20180820',
      ReportScope: JobReportScope.AllTasks,
    },
  });
}
