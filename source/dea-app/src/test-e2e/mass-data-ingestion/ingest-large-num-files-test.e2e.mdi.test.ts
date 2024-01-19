/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import { enc } from 'crypto-js';
import sha256 from 'crypto-js/sha256';
import { retry } from '../../app/services/service-helpers';
import { Oauth2Token } from '../../models/auth';
import { CaseFileDTO, DeaCaseFileResult } from '../../models/case-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  createCaseAssociationSuccess,
  createDataVaultExecutionSuccess,
  createDataVaultSuccess,
  createDataVaultTaskSuccess,
  describeDataVaultDetailsSuccess,
  listDataVaultFilesSuccess,
  verifyAllExecutionsSucceeded,
  waitForDataSyncStartupTime,
  waitForTaskExecutionCompletions,
} from '../resources/support/datavault-support';
import {
  delay,
  MINUTES_TO_MILLISECONDS,
  callDeaAPIWithCreds,
  createCaseSuccess,
  downloadContentFromS3,
  randomSuffix,
  describeCaseSuccess,
} from '../resources/test-helpers';
import { batchActions, MdiTestHelper, SourceLocation, parseHash, partitionArray } from './mdi-test-helpers';

const NUMBER_OF_FILES = 1000;
const DOWNLOAD_FILE_RETRIES = 10;
const RETRY_SLEEP = 30000; // 30 seconds

describe('ingests files from a source with a lot of files', () => {
  const cognitoHelper = new CognitoHelper();
  const randSuffix = randomSuffix();

  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  let dataVaultUlid: string;
  let sourceLocation: SourceLocation;

  const mdiTestHelper = new MdiTestHelper(`IngestManyFilesMDITestUser`, randSuffix);

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(
      mdiTestHelper.testUser,
      'WorkingManager',
      'IngestManyFiles',
      'MDITestUser'
    );
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    // Create a Data Vault and Destination Location
    dataVaultUlid = (
      await createDataVaultSuccess(
        deaApiUrl,
        {
          name: `Large num files MDI E2ETests ${randSuffix} Vault`,
        },
        idToken,
        creds
      )
    ).ulid;

    sourceLocation = await mdiTestHelper.addSourceLocation('many-files-source');
    // Add 10,000 files
    const promises: Promise<void>[] = [];
    for (let i = 1; i <= NUMBER_OF_FILES; i++) {
      promises.push(addFile(i));
    }
    await Promise.all(promises);
  }, 3000000);

  afterAll(async () => {
    await delay(2 * MINUTES_TO_MILLISECONDS);

    // Refresh creds because this is a long running test
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    await mdiTestHelper.cleanup(creds, idToken, /*sleep=*/ 2 * MINUTES_TO_MILLISECONDS);

    await cognitoHelper.cleanup();
  }, 8000000);

  // 1. Create Task
  // 2. Execute Task
  // 3. Verify Data Vault Files
  // 4. Create Case
  // 5. Associate all the files
  // 6. Verify hashes of all the case files
  it('moves all the files with mass ingestion', async () => {
    // 1. Create Task
    const task = await createDataVaultTaskSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVaultUlid,
      mdiTestHelper.tasksToCleanUp,
      mdiTestHelper.dataSyncLocationsToCleanUp,
      {
        name: `Large num files ingestion: ${randSuffix}`,
        sourceLocationArn: sourceLocation.locationArn,
        description: `testing ingesting a lot of files from the source`,
      }
    );

    // 2. Execute Task
    const executionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, task.taskId, {
        taskArn: task.taskArn,
      })
    ).executionId;

    await waitForDataSyncStartupTime();

    // Wait for executions to complete
    const taskStatuses = await waitForTaskExecutionCompletions([`${task.taskArn}/execution/${executionId}`]);
    if (!verifyAllExecutionsSucceeded(taskStatuses)) {
      console.log('Failed executing some tasks, printing out tasks statuses...');
      for (const [taskArn, status] of taskStatuses.entries()) {
        console.log(`Task ${taskArn} completed with ${status}`);
      }
      throw new Error('Not all execution tasks succeeded');
    }

    const numRetries = 5;
    for (let i = 0; i < numRetries; i++) {
      const vaultDescription = await describeDataVaultDetailsSuccess(
        deaApiUrl,
        idToken,
        creds,
        dataVaultUlid
      );
      if (vaultDescription.objectCount == NUMBER_OF_FILES) {
        break;
      } else if (i === numRetries - 1) {
        throw new Error(
          `Expected vault to have ${NUMBER_OF_FILES}, instead has ${vaultDescription.objectCount}`
        );
      } else {
        console.log(
          `Not all files in the vault yet, (expected ${NUMBER_OF_FILES}, actual ${vaultDescription.objectCount}), sleeping for 1 minute`
        );
        await delay(1 * MINUTES_TO_MILLISECONDS);
      }
    }

    // 3. Get Data Vault Files
    const dataVaultFiles = await listDataVaultFilesSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVaultUlid,
      /*filePath=*/ undefined,
      /*limit=*/ NUMBER_OF_FILES
    );
    const dvFileUlids = dataVaultFiles.map((file) => file.ulid);
    expect(dvFileUlids.length).toBe(NUMBER_OF_FILES);

    // 4. Create Case
    const deaCase = await createCaseSuccess(
      deaApiUrl,
      {
        name: `Many Files Ingestion E2ETests ${randSuffix} Case`,
      },
      idToken,
      creds
    );
    mdiTestHelper.casesToCleanup.set(deaCase.ulid ?? fail(), deaCase.name ?? fail());
    expect(deaCase.objectCount).toBe(0);

    // 5. Associate all the files
    // TODO: Once CreateCaseAssociation API becomes async, associate all files at once
    // and wait for completion. For now the API cannot handle all 10000 files, so
    // split into chunks and associate
    const caseFiles: DeaCaseFileResult[] = [];
    const filesChunks = partitionArray(dvFileUlids);
    for (const fileUlids of filesChunks) {
      caseFiles.push(
        ...(await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVaultUlid, {
          caseUlids: [deaCase.ulid],
          fileUlids,
        }))
      );
    }

    for (let i = 0; i < numRetries; i++) {
      const caseDescription = await describeCaseSuccess(deaApiUrl, deaCase.ulid, idToken, creds);
      if (caseDescription.objectCount == NUMBER_OF_FILES) {
        break;
      } else if (i == numRetries - 1) {
        throw new Error(
          `Expected case to have ${NUMBER_OF_FILES}, instead has ${caseDescription.objectCount}`
        );
      } else {
        console.log(
          `Not all files in the case yet, (expected ${NUMBER_OF_FILES}, actual ${caseDescription.objectCount}), sleeping for 1 minute`
        );
        await delay(1 * MINUTES_TO_MILLISECONDS);
      }
    }

    // 6. Verify hashes of all the case files
    const downloadVerifications = await batchActions(
      async (fileBatch: DeaCaseFileResult[]) => {
        const verifPromises: Promise<string>[] = [];
        for (const file of fileBatch) {
          verifPromises.push(downloadFileAndValidateHash(file));
        }
        return await Promise.all(verifPromises);
      },
      caseFiles,
      /*batchSleep=*/ 50,
      /*batchSize=*/ 100
    );

    const hashErrors = downloadVerifications.filter((v) => v !== '');
    if (hashErrors.length != 0) {
      console.log('Hash validations failed. Printing failures...');
      hashErrors.forEach((error) => console.log(error));
      throw new Error('Hash validations failed');
    }
  }, 800000000);

  async function addFile(fileNum: number) {
    const fileName = `file${fileNum}-${randSuffix}`;
    const body = `${sourceLocation.bucketName}-file${fileNum} body`;
    await mdiTestHelper.addSourceFile(fileName, /*filePath=*/ '', body, sourceLocation);
  }

  async function downloadFileAndValidateHash(caseFile: CaseFileDTO): Promise<string> {
    const downloadUrl = await getFileDownloadUrl(caseFile.caseUlid, caseFile.ulid);

    const downloadedContent = await downloadContentFromS3(downloadUrl, caseFile.contentType);

    const actualHash = parseHash(sha256(downloadedContent).toString(enc.Base64));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const caseFileHash = parseHash(caseFile.sha256Hash!);

    if (actualHash !== caseFileHash) {
      return `Hash verification for ${caseFile.ulid} failed, expected ${caseFileHash} actual ${actualHash}.`;
    }

    return '';
  }

  async function getFileDownloadUrl(caseUlid: string, fileUlid: string): Promise<string> {
    const resp = await retry(
      async () => {
        const response = await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${caseUlid}/files/${fileUlid}/contents`,
          'GET',
          idToken,
          creds
        );

        if (response.status == 200) {
          return response.data.downloadUrl;
        } else {
          throw new Error('Unable to download file');
        }
      },
      DOWNLOAD_FILE_RETRIES,
      RETRY_SLEEP
    );

    return resp;
  }
});
