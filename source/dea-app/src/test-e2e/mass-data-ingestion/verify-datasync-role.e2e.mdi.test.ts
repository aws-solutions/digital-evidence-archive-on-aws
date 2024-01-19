/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateLocationS3Command,
  CreateTaskCommand,
  DataSyncClient,
  OverwriteMode,
  PreserveDeletedFiles,
  ReportLevel,
  ReportOutputType,
  S3StorageClass,
  StartTaskExecutionCommand,
  TaskExecutionStatus,
  VerifyMode,
} from '@aws-sdk/client-datasync';
import { CreateBucketCommand, DeleteBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { testEnv } from '../helpers/settings';
import {
  cleanupDataSyncTestResources,
  waitForTaskExecutionCompletions,
} from '../resources/support/datavault-support';
import { randomSuffix } from '../resources/test-helpers';

describe('verifies least privilege on datasync role', () => {
  const randSuffix = randomSuffix();
  const sourceBucketName = `dea-mdi-test-source${randSuffix}`;
  const destinationBucketName = `dea-mdi-test-dest${randSuffix}`;

  const dataSyncClient = new DataSyncClient({ region: testEnv.awsRegion });
  const s3Client = new S3Client({ region: testEnv.awsRegion });
  const stsClient = new STSClient({ region: testEnv.awsRegion });

  beforeAll(async () => {
    // Create the S3 Buckets
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: sourceBucketName,
      })
    );

    await s3Client.send(
      new CreateBucketCommand({
        Bucket: destinationBucketName,
      })
    );
  }, 100000);

  afterAll(async () => {
    await s3Client.send(
      new DeleteBucketCommand({
        Bucket: sourceBucketName,
      })
    );

    await s3Client.send(
      new DeleteBucketCommand({
        Bucket: destinationBucketName,
      })
    );
  }, 3000000);

  it('fails to grant access outside datasync', async () => {
    await expect(
      stsClient.send(
        new AssumeRoleCommand({
          RoleArn: testEnv.DataSyncRole,
          RoleSessionName: `mdi-ds-role-test-${randSuffix}`,
          DurationSeconds: 900,
        })
      )
    ).rejects.toThrow(/is not authorized to perform/g);
  });

  it('tries and fails to do non-dea task on the datasync role', async () => {
    const source = await dataSyncClient.send(
      new CreateLocationS3Command({
        S3BucketArn: `arn:aws:s3:::${sourceBucketName}`,
        S3Config: {
          BucketAccessRoleArn: testEnv.DataSyncRole,
        },
        S3StorageClass: S3StorageClass.INTELLIGENT_TIERING,
      })
    );
    const dest = await dataSyncClient.send(
      new CreateLocationS3Command({
        S3BucketArn: `arn:aws:s3:::${destinationBucketName}`,
        S3Config: {
          BucketAccessRoleArn: testEnv.DataSyncRole,
        },
        S3StorageClass: S3StorageClass.INTELLIGENT_TIERING,
      })
    );

    const task = await dataSyncClient.send(
      new CreateTaskCommand({
        SourceLocationArn: source.LocationArn,
        DestinationLocationArn: dest.LocationArn,
        Name: `Data Sync Role test ${randSuffix}`,
        Options: {
          VerifyMode: VerifyMode.ONLY_FILES_TRANSFERRED,
          OverwriteMode: OverwriteMode.NEVER,
          PreserveDeletedFiles: PreserveDeletedFiles.PRESERVE,
        },
        TaskReportConfig: {
          Destination: {
            S3: {
              S3BucketArn: `arn:aws:s3:::${testEnv.DataSyncReportsBucket}`,
              BucketAccessRoleArn: testEnv.DataSyncReportsRole,
            },
          },
          OutputType: ReportOutputType.STANDARD,
          ReportLevel: ReportLevel.SUCCESSES_AND_ERRORS,
        },
      })
    );

    // Now try to execute
    const execution = await dataSyncClient.send(
      new StartTaskExecutionCommand({
        TaskArn: task.TaskArn,
      })
    );

    const execArn = execution.TaskExecutionArn!;

    const taskResult = await waitForTaskExecutionCompletions([execArn]);
    expect(taskResult.size).toBe(1);
    const result = taskResult.get(execArn)!;
    expect(result).toBe(TaskExecutionStatus.ERROR);

    // Cleanup
    await cleanupDataSyncTestResources([task.TaskArn!], [source.LocationArn!, dest.LocationArn!]);
  }, 3000000);
});
