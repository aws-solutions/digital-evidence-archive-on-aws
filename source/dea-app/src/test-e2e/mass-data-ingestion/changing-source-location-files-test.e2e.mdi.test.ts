/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeleteObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Credentials } from 'aws4-axios';
import { enc } from 'crypto-js';
import sha256 from 'crypto-js/sha256';
import { Oauth2Token } from '../../models/auth';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  createCaseAssociationSuccess,
  createDataVaultExecutionSuccess,
  createDataVaultSuccess,
  createDataVaultTaskSuccess,
  describeDataVaultFileDetailsSuccess,
  listDataVaultFilesSuccess,
  verifyAllExecutionsSucceeded,
  waitForDataSyncStartupTime,
  waitForTaskExecutionCompletions,
} from '../resources/support/datavault-support';
import {
  createCaseSuccess,
  describeCaseFileDetailsSuccess,
  downloadContentFromS3,
  getCaseFileDownloadUrl,
  listCaseFilesSuccess,
  randomSuffix,
} from '../resources/test-helpers';
import {
  MdiTestHelper,
  s3Client,
  SourceLocation,
  verifyDataVaultFolderAndFileStructure,
} from './mdi-test-helpers';

describe('evolves source location structure and re-runs tasks', () => {
  const cognitoHelper = new CognitoHelper();
  const randSuffix = randomSuffix();

  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  let dataVaultUlid: string;
  let sourceLocation: SourceLocation;

  const mdiTestHelper = new MdiTestHelper(`EvolvingSourceMDITestUser`, randSuffix);

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(mdiTestHelper.testUser, 'WorkingManager', 'EvolvingSource', 'MDITestUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    // Create a Data Vault and Destination Location
    dataVaultUlid = (
      await createDataVaultSuccess(
        deaApiUrl,
        {
          name: `Source Size E2ETests ${randSuffix} Vault`,
        },
        idToken,
        creds
      )
    ).ulid;

    sourceLocation = await mdiTestHelper.addSourceLocation('test-evolving-source');
  }, 100000);

  afterAll(async () => {
    // Refresh creds because this is a long running test
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    await mdiTestHelper.cleanup(creds, idToken);

    await cognitoHelper.cleanup();
  }, 3000000);

  it('changes number of files in source location and re-runs task', async () => {
    // 1. Add some files to source location
    const originalNumFiles = 3;
    for (let i = 1; i <= originalNumFiles; i++) {
      await addFile(i);
    }

    // 2. Create Data Sync Task
    const task = await createDataVaultTaskSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVaultUlid,
      mdiTestHelper.tasksToCleanUp,
      mdiTestHelper.dataSyncLocationsToCleanUp,
      {
        name: `Source Size E2ETests ${randSuffix} Task`,
        sourceLocationArn: sourceLocation.locationArn,
        description: `task for changing source size by adding and removing files E2E tests`,
      }
    );

    // 3. Execute Task
    async function executeTask(): Promise<string> {
      const executionId = (
        await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, task.taskId, {
          taskArn: task.taskArn,
        })
      ).executionId;

      await waitForDataSyncStartupTime();

      const taskStatus = await waitForTaskExecutionCompletions([`${task.taskArn}/execution/${executionId}`]);
      expect(taskStatus.size).toBe(1);
      verifyAllExecutionsSucceeded(taskStatus);

      return executionId;
    }
    const executionId1 = await executeTask();

    // 4. Verify Data Vault Structure
    const originalDvFiles = mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
      sourceLocation,
      /*folderName=*/ '',
      originalNumFiles,
      /*dataVaultFolderPrefix=*/ '/',
      executionId1
    );
    await verifyDataVaultFolderAndFileStructure(
      idToken,
      creds,
      dataVaultUlid,
      originalNumFiles,
      new Map([
        // Root should only have the 3 files
        ['/', originalDvFiles],
      ])
    );

    // 5. Add some files to the the Data Vault
    const additionalFilesToAdd = 2;
    for (let i = originalNumFiles + 1; i <= originalNumFiles + additionalFilesToAdd; i++) {
      await addFile(i);
    }

    // 6. Execute Task Again
    const executionId2 = await executeTask();
    const expectedNumFiles = originalNumFiles + additionalFilesToAdd;

    // VERIFY the new files are present
    const addedFiles = mdiTestHelper
      .createAssocDVFileVerificationObjectsForS3Files(
        sourceLocation,
        /*folderName=*/ '',
        expectedNumFiles,
        /*dataVaultFolderPrefix=*/ '/',
        executionId2
      )
      .slice(originalNumFiles, expectedNumFiles);
    expect(addedFiles.length).toBe(additionalFilesToAdd);
    await verifyDataVaultFolderAndFileStructure(
      idToken,
      creds,
      dataVaultUlid,
      expectedNumFiles,
      new Map([
        // Root should only have the 5 files
        ['/', [...originalDvFiles, ...addedFiles]],
      ])
    );

    // 7. Change a file in the data vault, re-run task, verify the file not overwritten

    // Modify File
    const originalFile = sourceLocation.files[0];
    const fileS3Key = originalFile.fileS3Key;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: sourceLocation.bucketName,
        Key: fileS3Key,
        Body: `updated body`,
      })
    );

    // Rerun task
    await executeTask();

    // VERIFY DataVault Structure (same as last execution, nothing should have changed)
    await verifyDataVaultFolderAndFileStructure(
      idToken,
      creds,
      dataVaultUlid,
      expectedNumFiles,
      new Map([
        // Root should only have the 5 files
        ['/', [...originalDvFiles, ...addedFiles]],
      ])
    );

    // VERIFY the file was not overwritten, hash stays the same

    // we can't download DV files so to verify the file wasn't changed
    // we have to associate to the case then download the file and verify the hash that way
    const deaCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: `Source Size E2ETests ${randSuffix} Case`,
      },
      idToken,
      creds
    );
    mdiTestHelper.casesToCleanup.set(deaCase.ulid ?? fail(), deaCase.name ?? fail());

    const dvFiles = await listDataVaultFilesSuccess(deaApiUrl, idToken, creds, dataVaultUlid);
    const modifiedDataVaultFile = dvFiles.filter((file) => file.fileName === originalFile.fileName);
    expect(modifiedDataVaultFile.length).toBe(1);
    await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVaultUlid, {
      caseUlids: [deaCase.ulid],
      fileUlids: [modifiedDataVaultFile[0].ulid],
    });
    const caseFile = (await listCaseFilesSuccess(deaApiUrl, idToken, creds, deaCase.ulid)).files;
    expect(caseFile.length).toBe(1);
    const downloadUrl = await getCaseFileDownloadUrl(
      deaApiUrl,
      idToken,
      creds,
      deaCase.ulid,
      caseFile[0].ulid,
      "e2e test needs to download file",
    );
    const downloadedContent = await downloadContentFromS3(downloadUrl, caseFile[0].contentType);
    expect(sha256(downloadedContent).toString(enc.Base64)).toEqual(originalFile.sha256Hash);

    // 8. Remove the modified file from the source, re-run task
    const response = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: sourceLocation.bucketName,
        Delete: {
          Objects: [{ Key: originalFile.fileS3Key }],
        },
      })
    );
    expect(response.Deleted?.length).toBe(1);
    // Remove it from the source location files obj so we don't try to delete this file twice
    sourceLocation.files.shift();

    // Rerun the task
    await executeTask();

    // VERIFY the deleted file is STILL in the data vault by calling GetDataVaultFileDetails
    await describeDataVaultFileDetailsSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVaultUlid,
      modifiedDataVaultFile[0].ulid
    );
    // VERIFY Case file still exists
    await describeCaseFileDetailsSuccess(deaApiUrl, idToken, creds, deaCase.ulid, caseFile[0].ulid);
    // VERIFY Vault Structure (same as last execution, nothing should have changed)
    await verifyDataVaultFolderAndFileStructure(
      idToken,
      creds,
      dataVaultUlid,
      expectedNumFiles,
      new Map([
        // Root should only have the 5 files
        ['/', [...originalDvFiles, ...addedFiles]],
      ])
    );
  }, 3000000);

  async function addFile(fileNum: number) {
    const fileName = `file${fileNum}-${randSuffix}`;
    const body = `${sourceLocation.bucketName}-file${fileNum} body`;
    await mdiTestHelper.addSourceFile(fileName, /*filePath=*/ '', body, sourceLocation);
  }
});
