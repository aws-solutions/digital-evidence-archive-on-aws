/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import {
  S3Client,
  ServiceInputTypes as S3Input,
  ServiceOutputTypes as S3Output,
  DeleteObjectCommand,
  S3ClientResolvedConfig,
} from '@aws-sdk/client-s3';
import { S3ControlClient } from '@aws-sdk/client-s3-control';
import { SQSClient } from '@aws-sdk/client-sqs';
import {
  STSClient,
  STSClientResolvedConfig,
  ServiceInputTypes as STSInputs,
  ServiceOutputTypes as STSOutputs,
} from '@aws-sdk/client-sts';
import { S3BatchEvent, S3BatchResult, S3BatchResultResultCode } from 'aws-lambda';
import { AwsClientStub, AwsStub, mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { LambdaProviders } from '../../app/resources/dea-gateway-proxy-handler';
import { getCase } from '../../app/services/case-service';
import { getCustomUserAgent } from '../../lambda-http-helpers';
import { DeaCaseInput } from '../../models/case';
import { CaseFileStatus } from '../../models/case-file-status';
import { DeaUser } from '../../models/user';
import { createCase } from '../../persistence/case';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { createUser } from '../../persistence/user';
import { deleteCaseFileHandler } from '../../storage/s3-batch-delete-case-file-handler';
import { testEnv } from '../../test-e2e/helpers/settings';
import {
  callCompleteCaseFileUpload,
  callGetCaseFileDetails,
  callInitiateCaseFileUpload,
  DATASETS_PROVIDER,
} from '../app/resources/case-file-integration-test-helper';
import { createTestProvidersObject, dummyContext } from '../integration-objects';
import { getTestRepositoryProvider } from '../persistence/local-db-table';

export const CALLBACK_FN = () => {
  return 'dummy';
};
const VERSION_ID = 'version';
const TASK_ID = 'task_id';
const INVOCATION_ID = 'invocation';
const INVOCATION_SCHEMA = '1.0';

let repositoryProvider: ModelRepositoryProvider;
let testProviders: LambdaProviders;
let caseOwner: DeaUser;
let s3Mock: AwsStub<S3Input, S3Output, S3ClientResolvedConfig>;
let stsMock: AwsStub<STSInputs, STSOutputs, STSClientResolvedConfig>;
let sqsMock: AwsClientStub<SQSClient>;

describe('S3 batch delete case-file lambda', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('s3BatchDeleteCaseFileLambda');
    testProviders = createTestProvidersObject({ repositoryProvider, datasetsProvider: DATASETS_PROVIDER });

    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          idPoolId: 'caseowneridentityid',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();

    stsMock = mockClient(STSClient);
    stsMock.resolves({
      Credentials: {
        AccessKeyId: 'hi',
        SecretAccessKey: 'hello',
        SessionToken: 'foo',
        Expiration: new Date(),
      },
    });

    sqsMock = mockClient(SQSClient);
    sqsMock.resolves({});
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
      ETag: 'ETAG',
      Parts: [
        {
          ETag: 'I am an etag',
          PartNumber: 99,
        },
      ],
    });
  });

  it('should successfully delete files and update case-file status', async () => {
    const theCase: DeaCaseInput = {
      name: 'happy path',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);
    const caseId = createdCase.ulid;

    const caseFileUpload = await callInitiateCaseFileUpload(caseOwner.ulid, testProviders, caseId, 'file1');
    const fileId = caseFileUpload.ulid ?? fail();
    const caseFile = await callCompleteCaseFileUpload(caseOwner.ulid, testProviders, fileId, caseId);

    const response = await deleteCaseFileHandler(
      getS3BatchDeleteCaseFileEvent(caseId, fileId, caseFile.versionId ?? null),
      dummyContext,
      CALLBACK_FN,
      repositoryProvider,
      DATASETS_PROVIDER
    );
    const deletedCaseFile = await callGetCaseFileDetails(caseOwner.ulid, testProviders, fileId, caseId);
    expect(deletedCaseFile.status).toEqual(CaseFileStatus.DELETED);

    const expectedResult = `Successfully deleted object: ${caseId}/${fileId}`;
    expect(response).toEqual(getS3BatchResult(caseId, fileId, 'Succeeded', expectedResult));

    const updatedCase = (await getCase(caseId, repositoryProvider)) ?? fail();
    expect(updatedCase.objectCount).toEqual(0);
    expect(updatedCase.totalSizeBytes).toEqual(0);

    expect(s3Mock).toHaveReceivedCommandTimes(DeleteObjectCommand, 1);
    expect(s3Mock).toHaveReceivedCommandWith(DeleteObjectCommand, {
      Bucket: DATASETS_PROVIDER.bucketName,
      Key: `${caseId}/${fileId}`,
      VersionId: VERSION_ID,
    });
  });

  it('should mark as failed when no versionId in event', async () => {
    const theCase: DeaCaseInput = {
      name: 'no version id',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);
    const caseId = createdCase.ulid;

    const caseFile = await callInitiateCaseFileUpload(caseOwner.ulid, testProviders, caseId, 'file1');
    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(caseOwner.ulid, testProviders, fileId, caseId);

    const response = await deleteCaseFileHandler(
      getS3BatchDeleteCaseFileEvent(caseId, fileId, null),
      dummyContext,
      CALLBACK_FN,
      repositoryProvider,
      DATASETS_PROVIDER
    );
    const notDeletedCaseFile = await callGetCaseFileDetails(caseOwner.ulid, testProviders, fileId, caseId);

    const expectedResult = `Missing Version ID for key: ${caseId}/${fileId}`;

    expect(response).toEqual(getS3BatchResult(caseId, fileId, 'PermanentFailure', expectedResult));
    expect(notDeletedCaseFile.status).toEqual(CaseFileStatus.ACTIVE);

    expect(s3Mock).toHaveReceivedCommandTimes(DeleteObjectCommand, 0);
  });

  it('should mark as failed when no case file exists', async () => {
    const theCase: DeaCaseInput = {
      name: 'no case file',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);
    const caseId = createdCase.ulid;

    const response = await deleteCaseFileHandler(
      getS3BatchDeleteCaseFileEvent(caseId, caseId, 'version-id'),
      dummyContext,
      CALLBACK_FN,
      repositoryProvider,
      DATASETS_PROVIDER
    );

    const expectedResult = `Could not find case file: fileId: ${caseId}, caseId: ${caseId}`;
    expect(response).toEqual(getS3BatchResult(caseId, caseId, 'PermanentFailure', expectedResult));
    expect(s3Mock).toHaveReceivedCommandTimes(DeleteObjectCommand, 0);
  });

  it('should mark as failed when delete is not allowed in installation', async () => {
    const theCase: DeaCaseInput = {
      name: 'delete not allowed',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);
    const caseId = createdCase.ulid;

    const caseFile = await callInitiateCaseFileUpload(caseOwner.ulid, testProviders, caseId, 'file1');
    const fileId = caseFile.ulid ?? fail();
    await callCompleteCaseFileUpload(caseOwner.ulid, testProviders, fileId, caseId);

    const datasetsProvider = {
      s3Client: new S3Client({
        region: testEnv.awsRegion,
        useFipsEndpoint: testEnv.awsUseFipsEndpoint,
        customUserAgent: getCustomUserAgent(),
      }),
      s3ControlClient: new S3ControlClient({
        region: testEnv.awsRegion,
        useFipsEndpoint: testEnv.awsUseFipsEndpoint,
        customUserAgent: getCustomUserAgent(),
      }),
      bucketName: 'testBucket',
      uploadPresignedCommandExpirySeconds: 3600,
      downloadPresignedCommandExpirySeconds: 900,
      deletionAllowed: false,
      s3BatchDeleteCaseFileLambdaArn: 'arn:aws:lambda:us-east-1:1234:function:foo',
      s3BatchDeleteCaseFileRole: 'arn:aws:iam::1234:role/foo',
      sourceIpValidationEnabled: true,
      endUserUploadRole: 'arn:aws:iam::1234:role/baz',
      datasetsRole: 'arn:aws:iam::1234:role/bar',
      awsPartition: 'aws',
      checksumQueueUrl: 'checksumQueueUrl',
    };

    const response = await deleteCaseFileHandler(
      getS3BatchDeleteCaseFileEvent(caseId, fileId, 'version-id'),
      dummyContext,
      CALLBACK_FN,
      repositoryProvider,
      datasetsProvider
    );

    const expectedResult = 'This installation of DEA does not allow deletion';
    expect(response).toEqual(getS3BatchResult(caseId, caseId, 'PermanentFailure', expectedResult));
    expect(s3Mock).toHaveReceivedCommandTimes(DeleteObjectCommand, 0);
  });

  it('should mark as failed when delete-object fails', async () => {
    const theCase: DeaCaseInput = {
      name: 's3 client failure',
      description: 'description',
    };
    const createdCase = await createCase(theCase, caseOwner, repositoryProvider);
    const caseId = createdCase.ulid;

    const caseFileUpload = await callInitiateCaseFileUpload(caseOwner.ulid, testProviders, caseId, 'file1');
    const fileId = caseFileUpload.ulid ?? fail();
    const caseFile = await callCompleteCaseFileUpload(caseOwner.ulid, testProviders, fileId, caseId);

    s3Mock.rejects('failure time!!');

    const response = await deleteCaseFileHandler(
      getS3BatchDeleteCaseFileEvent(caseId, fileId, caseFile.versionId ?? null),
      dummyContext,
      CALLBACK_FN,
      repositoryProvider,
      DATASETS_PROVIDER
    );
    const notDeletedCaseFile = await callGetCaseFileDetails(caseOwner.ulid, testProviders, fileId, caseId);

    const expectedResult = `Failed to delete object: ${caseId}/${fileId}`;

    expect(response).toEqual(getS3BatchResult(caseId, fileId, 'TemporaryFailure', expectedResult));
    expect(notDeletedCaseFile.status).toEqual(CaseFileStatus.DELETE_FAILED);
  });
});

export function getS3BatchDeleteCaseFileEvent(
  caseId: string,
  fileId: string,
  s3VersionId: string | null,
  s3BucketArn = DATASETS_PROVIDER.bucketName
): S3BatchEvent {
  return {
    tasks: [
      {
        taskId: TASK_ID,
        s3Key: `${caseId}/${fileId}`,
        s3VersionId,
        s3BucketArn,
      },
    ],
    invocationId: INVOCATION_ID,
    invocationSchemaVersion: INVOCATION_SCHEMA,
    job: {
      id: 'namaste',
    },
  };
}

export function getS3BatchResult(
  caseId: string,
  fileId: string,
  resultCode: S3BatchResultResultCode,
  resultString: string
): S3BatchResult {
  return {
    invocationSchemaVersion: INVOCATION_SCHEMA,
    invocationId: INVOCATION_ID,
    treatMissingKeysAs: 'PermanentFailure',
    results: [
      {
        taskId: TASK_ID,
        resultString,
        resultCode,
      },
    ],
  };
}
