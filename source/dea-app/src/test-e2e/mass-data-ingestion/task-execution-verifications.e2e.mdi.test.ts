/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CreateLocationS3Command,
  CreateTaskCommand,
  CreateTaskCommandOutput,
  OverwriteMode,
  PreserveDeletedFiles,
  ReportLevel,
  ReportOutputType,
  S3StorageClass,
  VerifyMode,
} from '@aws-sdk/client-datasync';
import { Credentials } from 'aws4-axios';
import { retry } from '../../app/services/service-helpers';
import { Oauth2Token } from '../../models/auth';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  createDataVaultSuccess,
  createS3DataSyncLocation,
  dataSyncClient,
  DATA_SYNC_THROTTLE_RETRIES,
  DATA_SYNC_THROTTLE_WAIT_INTERVAL_IN_MS,
} from '../resources/support/datavault-support';
import { callDeaAPIWithCreds, randomSuffix } from '../resources/test-helpers';
import { DATASETS_BUCKET_ARN, MdiTestHelper } from './mdi-test-helpers';

describe('verifies StartDataVaultTaskExecutions input checks', () => {
  const cognitoHelper = new CognitoHelper();
  const randSuffix = randomSuffix();

  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  let dataVaultUlid: string;
  let correctDestinationLocation: string;
  let correctSourceLocation: string;

  const mdiTestHelper = new MdiTestHelper(`ExecutionVerificationsMDITestUser`, randSuffix);

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(
      mdiTestHelper.testUser,
      'WorkingManager',
      'ExecutionVerifications',
      'MDITestUser'
    );
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    // Create a Data Vault and Destination Location
    dataVaultUlid = (
      await createDataVaultSuccess(
        deaApiUrl,
        {
          name: `IncorrectTasks E2ETest ${randSuffix} Vault`,
        },
        idToken,
        creds
      )
    ).ulid;
    correctDestinationLocation = await createS3DataSyncLocation(
      mdiTestHelper.dataSyncLocationsToCleanUp,
      DATASETS_BUCKET_ARN,
      `/DATAVAULT${dataVaultUlid}`
    );

    correctSourceLocation = (await mdiTestHelper.addSourceLocation('exec-verifications')).locationArn;
  }, 100000);

  afterAll(async () => {
    // Refresh creds because this is a long running test
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    await mdiTestHelper.cleanup(creds, idToken);

    await cognitoHelper.cleanup();
  }, 3000000);

  it('tries to execute tasks with incorrect settings', async () => {
    // Try calling ExecuteTask (DEA API) with various incorrect settings and verify they fail

    // CASE: Source Location Doesn't Exist
    const incorrectSource = changeLastLetter(correctSourceLocation);
    const expectedError = `Location ${incorrectSource.split('/')[1]} is not found.`;
    await createTask(
      `Source Location does not exist ${randSuffix}`,
      { sourceLocationArn: incorrectSource },
      expectedError
    );

    // CASE: Destination Location is not the datasets bucket
    const incorrectDestinationLocation = (await mdiTestHelper.addSourceLocation('baddestination'))
      .locationArn;
    const incorrectDestinationTask = await createTask(
      `Destination is not the datasets bucket ${randSuffix}`,
      { destinationLocationArn: incorrectDestinationLocation }
    );
    await createFailedExecution(incorrectDestinationTask);

    // CASE: Destination Location is not a data vault
    const nonDataVaultLocation = await mdiTestHelper.createLocationForBucket(
      DATASETS_BUCKET_ARN,
      /*folder=*/ ''
    );
    const nonDataVaultLocationTask = await createTask(`Destination is not a data vault ${randSuffix}`, {
      destinationLocationArn: nonDataVaultLocation,
    });
    await createFailedExecution(nonDataVaultLocationTask);

    // CASE: Data Vault does not exist
    const nonExistentDataVaultUlid = `XXXXXXXXXXXXXXXXXXXXXXXXXX`;
    const nonExistentDataVaultLocation = await mdiTestHelper.createLocationForBucket(
      DATASETS_BUCKET_ARN,
      /*folder=*/ `/DATAVAULT${nonExistentDataVaultUlid}`
    );
    const nonExistentDataVaultTask = await createTask(`Destination data vault does not exist ${randSuffix}`, {
      destinationLocationArn: nonExistentDataVaultLocation,
    });
    await createFailedExecution(nonExistentDataVaultTask);

    // CASE: Destination Location's storage class is not Intelligent Tiering
    const nonIntelligentTieringDestination = await retry(
      async () => {
        const locationArn = (
          await dataSyncClient.send(
            new CreateLocationS3Command({
              S3BucketArn: DATASETS_BUCKET_ARN,
              S3Config: {
                BucketAccessRoleArn: testEnv.DataSyncRole,
              },
              Subdirectory: `/DATAVAULT${dataVaultUlid}`,
              S3StorageClass: S3StorageClass.STANDARD,
            })
          )
        ).LocationArn;

        if (!locationArn) {
          throw new Error('Unable to create destination location');
        }
        mdiTestHelper.dataSyncLocationsToCleanUp.push(locationArn);

        return locationArn;
      },
      DATA_SYNC_THROTTLE_RETRIES,
      DATA_SYNC_THROTTLE_WAIT_INTERVAL_IN_MS
    );
    if (!nonIntelligentTieringDestination) {
      throw new Error('Unable to create destination location');
    }
    const nonIntelligentTieringDestinationTask = await createTask(
      `Destination has incorrect S3 Storage Tier ${randSuffix}`,
      { destinationLocationArn: nonIntelligentTieringDestination }
    );
    await createFailedExecution(nonIntelligentTieringDestinationTask);

    // Test Incorrect Task Report Settings

    // CASE: The IAM Role is not the correct IAM Role
    const incorrectIamRoleForReportTask = await createTask(
      `inccorect IAM Role for task report ${randSuffix}`,
      { bucketAccessRoleArn: testEnv.DataSyncRole }
    );
    await createFailedExecution(incorrectIamRoleForReportTask);

    // CASE: Report type is not STANDARD
    const incorrectReportTypeForReportTask = await createTask(
      `inccorect report type for task report ${randSuffix}`,
      { reportOutputType: ReportOutputType.SUMMARY_ONLY }
    );
    await createFailedExecution(incorrectReportTypeForReportTask);

    // CASE: Report Level is not SUCCESSES and errors
    const incorrectLevelForReportTask = await createTask(`inccorect level for task report ${randSuffix}`, {
      reportLevel: ReportLevel.ERRORS_ONLY,
    });
    await createFailedExecution(incorrectLevelForReportTask);

    // Test Incorrect Options Settings

    // CASE: Overwrite files is checked
    const overwriteTask = await createTask(`overwrite files task ${randSuffix}`, {
      overwriteMode: OverwriteMode.ALWAYS,
    });
    await createFailedExecution(overwriteTask);

    // CASE: Preserve deleted files is not selected
    const deleteDeletedFilesTask = await createTask(`delete deleted files task ${randSuffix}`, {
      preserveDeletedFiles: PreserveDeletedFiles.REMOVE,
    });
    await createFailedExecution(deleteDeletedFilesTask);

    // CASE: Verify Mode is incorrect
    const noVerificationTask = await createTask(`dont verify files task ${randSuffix}`, {
      verifyMode: VerifyMode.NONE,
    });
    await createFailedExecution(noVerificationTask);

    const pitVerificationTask = await createTask(`point in time verification files task ${randSuffix}`, {
      verifyMode: VerifyMode.POINT_IN_TIME_CONSISTENT,
    });
    await createFailedExecution(pitVerificationTask);
  }, 300000);

  type TaskInputMask = {
    sourceLocationArn?: string;
    destinationLocationArn?: string;
    verifyMode?: VerifyMode;
    overwriteMode?: OverwriteMode;
    preserveDeletedFiles?: PreserveDeletedFiles;
    taskReportS3Bucket?: string;
    bucketAccessRoleArn?: string;
    reportOutputType?: ReportOutputType;
    reportLevel?: ReportLevel;
  };
  async function createTask(
    name: string,
    input: TaskInputMask,
    expectedError?: string
  ): Promise<CreateTaskCommandOutput | void> {
    return await retry(
      async () => {
        try {
          const response = await dataSyncClient.send(
            new CreateTaskCommand({
              SourceLocationArn: input.sourceLocationArn ?? correctSourceLocation,
              DestinationLocationArn: input.destinationLocationArn ?? correctDestinationLocation,
              Name: name,
              Options: {
                VerifyMode: input.verifyMode ?? VerifyMode.ONLY_FILES_TRANSFERRED,
                OverwriteMode: input.overwriteMode ?? OverwriteMode.NEVER,
                PreserveDeletedFiles: input.preserveDeletedFiles ?? PreserveDeletedFiles.PRESERVE,
              },
              TaskReportConfig: {
                Destination: {
                  S3: {
                    S3BucketArn: input.taskReportS3Bucket ?? `arn:aws:s3:::${testEnv.DataSyncReportsBucket}`,
                    BucketAccessRoleArn: input.bucketAccessRoleArn ?? testEnv.DataSyncReportsRole,
                  },
                },
                OutputType: input.reportOutputType ?? ReportOutputType.STANDARD,
                ReportLevel:
                  input.reportOutputType === ReportOutputType.SUMMARY_ONLY
                    ? undefined
                    : input.reportLevel ?? ReportLevel.SUCCESSES_AND_ERRORS,
              },
            })
          );

          if (expectedError) {
            throw new Error('Expected to fail creating Data Sync Task, but it succeeded');
          }

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          mdiTestHelper.tasksToCleanUp.push(response.TaskArn!);
          return response;
        } catch (e) {
          if (!expectedError) {
            throw e;
          }

          expect(e.message).toStrictEqual(expectedError);
        }
      },
      DATA_SYNC_THROTTLE_RETRIES,
      DATA_SYNC_THROTTLE_WAIT_INTERVAL_IN_MS
    );
  }

  async function createFailedExecution(
    task: CreateTaskCommandOutput | void,
    expectedErr = 'Bad Request',
    expectedStatus = 400
  ) {
    if (!task) {
      throw new Error('Invalid task input');
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const taskArn = task.TaskArn!;
    const taskId = taskArn.split('/')[1];

    const response = await callDeaAPIWithCreds(
      `${deaApiUrl}datavaults/tasks/${taskId}/executions`,
      'POST',
      idToken,
      creds,
      {
        taskArn,
      }
    );

    expect(response.status).toBe(expectedStatus);
    expect(response.statusText).toStrictEqual(expectedErr);
  }
});

function changeLastLetter(arn: string): string {
  const newLastLetter = arn.charAt(arn.length - 1) === '0' ? '1' : '0';
  const newArn = arn.substring(0, arn.length - 1) + newLastLetter;
  return newArn;
}
