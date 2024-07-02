/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { S3EventRecord, S3Event } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { createDataVault } from '../../app/resources/create-data-vault';
import { createDataVaultExecution } from '../../app/resources/create-data-vault-execution';
import { createDataVaultTask } from '../../app/resources/create-data-vault-task';
import { createS3Location, describeDatasyncLocation } from '../../app/services/data-sync-service';
import { getDataVault } from '../../app/services/data-vault-service';
import { DeaDataVaultTask } from '../../models/data-vault-task';
import { DeaUser } from '../../models/user';
import { listDataVaultFilesByFilePath } from '../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { createUser } from '../../persistence/user';
import { DataSyncProvider, defaultDataSyncProvider } from '../../storage/dataSync';
import { dataSyncExecutionEvent, generateFolderPrefixEntries } from '../../storage/datasync-event-handler';
import { testEnv } from '../../test-e2e/helpers/settings';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../integration-objects';
import { getTestRepositoryProvider } from '../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let user: DeaUser;
let deaTask: DeaDataVaultTask;
const dataSyncProvider: DataSyncProvider = defaultDataSyncProvider;

describe('datasync event handler', () => {
  const region = testEnv.awsRegion;

  const mockS3Client = mockClient(S3Client);

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('datasyncEventHandlerTest');

    // create user
    user =
      (await createUser(
        {
          tokenId: 'FirstsixLastsix',
          idPoolId: 'FirstsixLastsixidentityid',
          firstName: 'Firstsix',
          lastName: 'Lastsix',
        },
        repositoryProvider
      )) ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');

    // Delete generated JSON file
    fs.unlinkSync('filtered_data.json');
  });

  it('should successfully add files from execution to database', async () => {
    const [deaDataVault, deaTask, deaExecution] = await dataVaultTestEnvSetup();

    // Create JSON for execution event
    // Write the CSV data to a file
    fs.writeFileSync(
      'filtered_data.json',
      JSON.stringify(createExecutionJSON(deaExecution.executionId)),
      'utf-8'
    );

    const sdkStream = sdkStreamMixin(fs.createReadStream('filtered_data.json'));

    mockS3Client.on(GetObjectCommand).resolves({
      Body: sdkStream,
    });

    // Get Object information to mock HeadObjectCommand
    const locationDetails = await describeDatasyncLocation(deaTask.destinationLocationArn, dataSyncProvider);
    if (!locationDetails || !locationDetails.LocationUri) {
      throw new Error('Could not find location details');
    }

    mockS3Client.on(HeadObjectCommand).resolves({
      VersionId: 'testVersion',
    });

    // Create Valid Task Report Location
    const reportKey = `Detailed-Reports/${deaTask.taskId}/${deaExecution.executionId}/${deaExecution.executionId}.files-verified-v1-00001-00000000000000000.json`;

    // Run datasync execution event
    await dataSyncExecutionEvent(
      getEventBridgeEvent(region, reportKey),
      dummyContext,
      () => {
        return;
      },
      repositoryProvider
    );

    // Check data vault for updated files
    const retreivedDataVault = await getDataVault(deaDataVault.ulid, repositoryProvider);

    if (!retreivedDataVault) {
      throw new Error('Could not find datavault details');
    }

    expect(retreivedDataVault.objectCount).toEqual(4);
    expect(retreivedDataVault.totalSizeBytes).toEqual(15364 * 4);

    // Check for files in data vault
    const dataVaultFiles = await listDataVaultFilesByFilePath(
      deaDataVault.ulid,
      '/testbucket/',
      10000,
      repositoryProvider
    );
    // Check for files in data vault
    const dataVaultFiles2 = await listDataVaultFilesByFilePath(
      deaDataVault.ulid,
      '/testbucket/folder1/',
      10000,
      repositoryProvider
    );

    expect(dataVaultFiles).toBeDefined();
    expect(dataVaultFiles.length).toEqual(3); // 2 files and 1 folder
    expect(dataVaultFiles2.length).toEqual(2); // 1 file and 1 folder
  }, 40000);

  it('should fail when executionId and taskId are not valid', async () => {
    // Create invalid Task Report Location
    const reportKey = `Detailed-Reports/task-00000000000000000/exec-00000000000000000/exec-00000000000000000.files-verified-v1-00001-00000000000000000.json`;
    const event = getEventBridgeEvent(region, reportKey);

    await expect(
      dataSyncExecutionEvent(
        event,
        dummyContext,
        () => {
          return;
        },
        repositoryProvider
      )
    ).rejects.toThrow('Could not find DataVaultExecution with id exec-00000000000000000');
  });

  it('should create folders based on location uri', async () => {
    const name = 'testDataVault2';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(
      event,
      dummyContext,
      createTestProvidersObject({ repositoryProvider })
    );
    const deaDataVault = await JSON.parse(response.body);

    const locationUri = `s3://sampleBucketName/DATAVAULT${deaDataVault.ulid}/folder 1/folder 2/folder 3/folder 4/`;
    const executionId = 'exec-00000000000000000';
    let prefixString = await generateFolderPrefixEntries(
      locationUri,
      deaDataVault.ulid,
      user.ulid,
      executionId,
      repositoryProvider
    );

    expect(prefixString).toEqual('/folder 1/folder 2/folder 3/folder 4');

    let dataVaultFiles = await listDataVaultFilesByFilePath(
      deaDataVault.ulid,
      '/folder 1/folder 2/folder 3/',
      10000,
      repositoryProvider
    );

    expect(dataVaultFiles).toBeDefined();
    expect(dataVaultFiles.length).toEqual(1); // should have 1 folder in this directory

    const locationUri2 = `s3://sampleBucketName/DATAVAULT${deaDataVault.ulid}/folder 1/folder 2/folder 3/folder ABC/`;
    prefixString = await generateFolderPrefixEntries(
      locationUri2,
      deaDataVault.ulid,
      user.ulid,
      executionId,
      repositoryProvider
    );

    expect(prefixString).toEqual('/folder 1/folder 2/folder 3/folder ABC');

    // Check for folders in data vault
    dataVaultFiles = await listDataVaultFilesByFilePath(deaDataVault.ulid, '/', 10000, repositoryProvider);
    expect(dataVaultFiles).toBeDefined();
    expect(dataVaultFiles.length).toEqual(1); // Only 1 folder in root - /folder1/

    dataVaultFiles = await listDataVaultFilesByFilePath(
      deaDataVault.ulid,
      '/folder 1/folder 2/folder 3/',
      10000,
      repositoryProvider
    );

    expect(dataVaultFiles).toBeDefined();
    expect(dataVaultFiles.length).toEqual(2); // should be 2 folders now in this directory

    const locationUri3 = `s3://sampleBucketName/DATAVAULT${deaDataVault.ulid}/`;
    prefixString = await generateFolderPrefixEntries(
      locationUri3,
      deaDataVault.ulid,
      user.ulid,
      executionId,
      repositoryProvider
    );

    expect(prefixString).toEqual('');
  });

  // Dummy event record generation for task/execution report
  function getEventBridgeEvent(region: string, reportKey: string) {
    const eventRecord: S3EventRecord = {
      eventVersion: '2.0',
      eventSource: 'aws:s3',
      awsRegion: region,
      eventTime: '1970-01-01T00:00:00.000Z',
      eventName: 'ObjectCreated:Put',
      userIdentity: {
        principalId: 'AWS:AAAAAAAAAAAAAAAAAAAAA:AwsDataSync-task-00000000000000000',
      },
      requestParameters: {
        sourceIPAddress: '10.0.111.111',
      },
      responseElements: {
        'x-amz-request-id': '00000000000000000',
        'x-amz-id-2': '00000000000000000',
      },
      s3: {
        s3SchemaVersion: '1.0',
        configurationId: '00000000000000000',
        bucket: {
          name: 'datasync-test-bucket',
          ownerIdentity: {
            principalId: 'AWS:AAAAAAAAAAAAAAAAAAAAA:AwsDataSync-task-00000000000000000',
          },
          arn: 'arn:aws:s3:::datasync-test-bucket',
        },
        object: {
          key: reportKey,
          size: 1024,
          eTag: '0123456789abcdef0123456789abcdef',
          sequencer: '0A1B2C3D4E5F678901',
        },
      },
    };

    const s3Event: S3Event = {
      Records: [eventRecord],
    };

    return s3Event;
  }

  // Create dummy JSON contents for verified files from execution
  function createExecutionJSON(executionId: string) {
    const json = {
      TaskExecutionId: executionId,
      Verified: [
        {
          RelativePath: '/testfile1.jpg',
          SrcMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          SrcChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          DstMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          DstChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          VerifyTimestamp: '2023-10-16T21:48:23.213451576Z',
          VerifyStatus: 'SUCCESS',
        },
        {
          RelativePath: '/exectest.json',
          SrcMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          SrcChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          DstMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          DstChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          VerifyTimestamp: '2023-10-16T21:48:23.213451576Z',
          VerifyStatus: 'SUCCESS',
        },
        {
          // This should be ignored. Directories in the task report are not processed as a dataVaultFile
          RelativePath: '/testfolder',
          SrcMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          SrcChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          DstMetadata: {
            Type: 'Directory',
            ContentSize: 0,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          DstChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          VerifyTimestamp: '2023-10-16T21:48:23.213451576Z',
          VerifyStatus: 'SUCCESS',
        },
        {
          RelativePath: '/folder1/exectest2.json',
          SrcMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          SrcChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          DstMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          DstChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          VerifyTimestamp: '2023-10-16T21:48:23.213451576Z',
          VerifyStatus: 'SUCCESS',
        },
        {
          RelativePath: '/folder1/folder2/exectest3.jpg',
          SrcMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          SrcChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          DstMetadata: {
            Type: 'Regular',
            ContentSize: 15364,
            Mtime: '2023-10-16T21:41:34.000000000Z',
          },
          DstChecksum: 'SHA256:d10d148d9839d2b4cd1219992d4a31b1eb456a64e5e7ce8dd3ac1fbade8a5852',
          VerifyTimestamp: '2023-10-16T21:48:23.213451576Z',
          VerifyStatus: 'SUCCESS',
        },
      ],
    };
    return json;
  }

  async function dataVaultTestEnvSetup() {
    // Create data vault, datasync task and execution
    const name = 'testDataVault';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const testProvider = createTestProvidersObject({ repositoryProvider });
    const response = await createDataVault(event, dummyContext, testProvider);
    const deaDataVault = await JSON.parse(response.body);

    // Create source location arn
    const locationArn1 = await createS3Location(
      `/DATAVAULT${deaDataVault.ulid}/locationtest1`,
      dataSyncProvider
    );

    const taskEvent = getDummyEvent({
      pathParameters: {
        dataVaultId: deaDataVault.ulid,
      },
      body: JSON.stringify({
        name: 'testTask',
        sourceLocationArn: locationArn1,
        destinationFolder: 'testbucket',
      }),
    });

    const taskResponse = await createDataVaultTask(taskEvent, dummyContext, testProvider);
    deaTask = JSON.parse(taskResponse.body);

    const taskArn = deaTask.taskArn;
    const taskId = deaTask.taskId;

    const executionEvent = getDummyEvent({
      pathParameters: {
        taskId,
      },
      body: JSON.stringify({
        taskArn,
      }),
    });
    executionEvent.headers['userUlid'] = user.ulid;

    const executionResponse = await createDataVaultExecution(executionEvent, dummyContext, testProvider);

    const deaExecution = JSON.parse(executionResponse.body);

    return [deaDataVault, deaTask, deaExecution];
  }
});
