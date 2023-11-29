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
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ObjectIdentifier,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Credentials } from 'aws4-axios';
import sha256 from 'crypto-js/sha256';
import { retry } from '../../app/services/service-helpers';
import { Oauth2Token } from '../../models/auth';
import { DeaCase } from '../../models/case';
import { CaseFileDTO, DeaCaseFileResult } from '../../models/case-file';
import { DeaDataVault } from '../../models/data-vault';
import { DeaDataVaultFile } from '../../models/data-vault-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  cleanupDataSyncTestResources,
  createCaseAssociationSuccess,
  createDataSyncTaskWithSDKSuccess,
  createDataVaultSuccess,
  createDataVaultExecutionSuccess,
  createDataVaultTaskSuccess,
  createS3DataSyncLocation,
  deleteCaseAssociationSuccess,
  describeDataVaultDetailsSuccess,
  describeDataVaultFileDetailsSuccess,
  listDataVaultFilesSuccess,
  listDataVaultsSuccess,
  updateDataVaultSuccess,
  verifyAllExecutionsSucceeded,
  waitForTaskExecutionCompletions,
  dataSyncClient,
  DATA_SYNC_THROTTLE_RETRIES,
  DATA_SYNC_THROTTLE_WAIT_INTERVAL_IN_MS,
} from './support/datavault-support';
import {
  callDeaAPIWithCreds,
  cleanupCaseAndFiles,
  createCaseSuccess,
  describeCaseFileDetailsSuccess,
  describeCaseSuccess,
  downloadContentFromS3,
  getCaseFileDownloadUrl,
  listCaseFilesSuccess,
  randomSuffix,
} from './test-helpers';

const s3Client = new S3Client({ region: testEnv.awsRegion });

/* Source Location Buckets and their "FileSystem" Structure 
    (S3 has no folder structure, but DataSync reads from S3 keys and makes folders as necessary)

    Source Bucket 1:
    /  (FOLDER)
      sl1-file1-${randSuffix}
      sl1-file2-${randSuffix}

    Source Bucket 2:
    / (FOLDER)
      sl2-rootfile-${randSuffix}
      sl2-folder1-${randSuffix}/ (FOLDER)
        sl2-folder1file1-${randSuffix}
        sl2-folder1file2-${randSuffix}
        nested (FOLDER) 
          sl2-folder1nestedfile-${randSuffix}
      sl2-folder2-${randSuffix} (FOLDER)
        nested (FOLDER)
          sl2-level2file1-${randSuffix}

    Source Bucket 3:
    / (FOLDER)
    sl3-folder1-${randSuffix} (FOLDER)
      sl3-folder1file1-${randSuffix}
      sl3-folder1file2-${randSuffix}
    sl3-folder2-${randSuffix} (FOLDER)
      sl3-folder2file1-${randSuffix}
      sl3-folder2file2-${randSuffix}
*/

describe('mass data ingestion e2e tests', () => {
  const cognitoHelper = new CognitoHelper();
  const randSuffix = randomSuffix();

  const DATASETS_BUCKET_ARN = `arn:aws:s3:::${testEnv.datasetsBucketName}`;

  const testUser = `massDataIngestionTestUser${randSuffix}`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  const tasksToCleanUp: string[] = [];
  const dataSyncLocationsToCleanUp: string[] = [];
  const casesToCleanup: Map<string, string> = new Map();
  // TODO: when data vaults can be deleted, make sure we clean up resources so
  // as to not clutter up the deployment when we run this multiple times
  // const dataVaultsToDelete: string[] = [];

  // NOTE: Do Not change the source bucket 'dea-mdi-e2e-test-source-bucket' prefix,
  // since it is hard coded into the DataSync Role when deployed as a testing stack
  const sourceBucket1 = `dea-mdi-e2e-test-source-bucket-1-${randSuffix}`;
  let sourceLocation1Arn: string;
  const sourceBucket2 = `dea-mdi-e2e-test-source-bucket-2-${randSuffix}`;
  let sourceLocation2Arn: string;
  const sourceBucket3 = `dea-mdi-e2e-test-source-bucket-3-${randSuffix}`;
  let sourceLocation3Arn: string;
  const s3BucketToObjectKeysMap: Map<string, SourceLocationFile[]> = new Map();

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'WorkingManager', 'MassDataIngestion', 'TestUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    // Create 3 S3 Buckets in different regions, (Will be used as source locations) and create files in each
    await createS3BucketForSourceLocation(sourceBucket1, s3BucketToObjectKeysMap);
    sourceLocation1Arn = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      `arn:aws:s3:::${sourceBucket1}`
    );
    await createS3BucketForSourceLocation(sourceBucket2, s3BucketToObjectKeysMap);
    sourceLocation2Arn = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      `arn:aws:s3:::${sourceBucket2}`
    );
    await createS3BucketForSourceLocation(sourceBucket3, s3BucketToObjectKeysMap);
    sourceLocation3Arn = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      `arn:aws:s3:::${sourceBucket3}`
    );

    // For each bucket create some files, see comment at top of file
    // for S3 object/folder structure
    await putObjectS3(
      sourceBucket1,
      `sl1-file1-${randSuffix}`,
      '',
      `${sourceBucket1}-file1 body`,
      s3BucketToObjectKeysMap
    );
    await putObjectS3(
      sourceBucket1,
      `sl1-file2-${randSuffix}`,
      '',
      `${sourceBucket1}-file2 body`,
      s3BucketToObjectKeysMap
    );

    await putObjectS3(
      sourceBucket2,
      `sl2-rootfile-${randSuffix}`,
      '',
      `${sourceBucket2}-root file body`,
      s3BucketToObjectKeysMap
    );
    // Put some nested folders
    await putObjectS3(
      sourceBucket2,
      `sl2-folder1file1-${randSuffix}`,
      `sl2-folder1-${randSuffix}/`,
      `/folder1/folder1file1 body`,
      s3BucketToObjectKeysMap
    );
    await putObjectS3(
      sourceBucket2,
      `sl2-folder1file2-${randSuffix}`,
      `sl2-folder1-${randSuffix}/`,
      `/folder1/file2 body`,
      s3BucketToObjectKeysMap
    );
    await putObjectS3(
      sourceBucket2,
      `sl2-level2file1-${randSuffix}`,
      `sl2-folder2-${randSuffix}/nested/`,
      `/sl2-folder2-${randSuffix}/nested/level2file1 body`,
      s3BucketToObjectKeysMap
    );
    await putObjectS3(
      sourceBucket2,
      `sl2-folder1nestedfile-${randSuffix}`,
      `sl2-folder1-${randSuffix}/nested/`,
      `/folder1/nested/folder1nestedfile body`,
      s3BucketToObjectKeysMap
    );

    await putObjectS3(
      sourceBucket3,
      `sl3-folder1file1-${randSuffix}`,
      `sl3-folder1-${randSuffix}/`,
      '/folder1/file1 body',
      s3BucketToObjectKeysMap
    );
    await putObjectS3(
      sourceBucket3,
      `sl3-folder1file2-${randSuffix}`,
      `sl3-folder1-${randSuffix}/`,
      '/folder1/file2 body',
      s3BucketToObjectKeysMap
    );
    await putObjectS3(
      sourceBucket3,
      `sl3-folder2file1-${randSuffix}`,
      `sl3-folder2-${randSuffix}/`,
      '/folder2/file1 body',
      s3BucketToObjectKeysMap
    );
    await putObjectS3(
      sourceBucket3,
      `sl3-folder2file2-${randSuffix}`,
      `sl3-folder2-${randSuffix}/`,
      '/folder2/file2 body',
      s3BucketToObjectKeysMap
    );
  }, 100000);

  afterAll(async () => {
    // Refresh creds because this is a long running test
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);

    // Clean up cases and case files
    for (const [caseUlid, caseName] of casesToCleanup.entries()) {
      try {
        await cleanupCaseAndFiles(deaApiUrl, caseUlid, caseName, idToken, creds);
      } catch (e) {
        console.log(`Failed cleaning up case ${caseUlid} during MDI E2E tests`);
        console.log(e);
      }
    }

    // TODO: when data vaults can be deleted, make sure we clean up resources so
    // as to not clutter up the deployment when we run this multiple times

    // Remove S3 objects and the bucket
    for (const [bucketName, files] of s3BucketToObjectKeysMap.entries()) {
      await deleteSourceObjects(bucketName, files);
      await deleteBucket(bucketName);
    }

    await cleanupDataSyncTestResources(tasksToCleanUp, dataSyncLocationsToCleanUp);

    await cognitoHelper.cleanup();
  }, 3000000);

  /* Test Mass Data Ingestion Workflow Using the DEA APIs
  1. Create 2 Data Vaults
     VERIFY
       -- Call ListDataVaults, see both vaults are there
  2. Create Data Sync Tasks for each vault
  3. Execute the Tasks
     VERIFY
       -- Query DataSync For Execution Statuses, ensure all finished with status SUCCESS
       -- Verify the Data Vault Folder/File Structure for both data vaults (BFS Tree Traversal)
  4. Create 2 Cases
  5. Create Case Associations for various Data Vault Files
     VERIFY
       -- Verify the Case Folder/File Structure for both cases
       -- For Each File Associated, verify the case count and ScopedCases has been updated by calling GetDataVaultFileDetails
       -- Download the case files and verify the hash matches the hash of the source object
  6. Delete Case Association from Both Cases
     VERIFY
       -- Verify the Case File Objects decreased by 1 for both cases
       -- Verify DescribeCaseFileDetails fail for the file for both cases
       -- GetDataVaultFile shows 0 case count and no scoped cases info
  7. Delete Case Association from Case1 but not from Case2
      VERIFY
       -- Case File Objects decreased by 1 for Case1, but Case2 stays the same
       -- DescribeCaseFileDetails fail for the file for Case1
       -- DescribeCaseFileDetails succeeds for the file for Case2
       -- GetDataVaultFile shows 1 case count and only case2 shows up in scoped cases
  8. Reverify Case Folder/File Structure for Both Cases after Disassociations
  */
  it('performs data ingestion using only DEA APIs and case association', async () => {
    // 1. Create Data Vaults
    const dataVault1 = await createDataVaultSuccess(
      deaApiUrl,
      {
        name: `DEA-API Only Data Vault Test ${randSuffix}: Vault1`,
      },
      idToken,
      creds
    );
    const dataVault2 = await createDataVaultSuccess(
      deaApiUrl,
      {
        name: `DEA-API Only Data Vault Test ${randSuffix}: Vault2`,
      },
      idToken,
      creds
    );

    // VERIFY: List Data Vaults, assert those data vaults are in there
    const dataVaults = (await listDataVaultsSuccess(deaApiUrl, idToken, creds)).dataVaults;
    expect(dataVaults.filter((vault) => vault.ulid === dataVault1.ulid).length).toBe(1);
    expect(dataVaults.filter((vault) => vault.ulid === dataVault2.ulid).length).toBe(1);

    // 2. Create Data Sync tasks for each vault
    const taskDv1Sl1 = await createDataVaultTaskSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVault1.ulid,
      tasksToCleanUp,
      {
        name: `DEA API Migration SL1 to DV1: ${randSuffix}`,
        sourceLocationArn: sourceLocation1Arn,
        description: `testing using all DEA APIs for migration, using sourceLocation1 to dataVault1`,
        destinationFolder: `filesFromSL1`,
      }
    );

    // All files from SL2 go to destination folder filesFromSL2
    const taskDv1Sl2 = await createDataVaultTaskSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVault1.ulid,
      tasksToCleanUp,
      {
        name: `DEA API Migration SL2 to DV1: ${randSuffix}`,
        sourceLocationArn: sourceLocation2Arn,
        description: `testing using all DEA APIs for migration, using sourceLocation2 to dataVault1`,
        destinationFolder: `filesFromSL2`,
      }
    );

    const taskDv2Sl1 = await createDataVaultTaskSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVault2.ulid,
      tasksToCleanUp,
      {
        name: `DEA API Migration SL1 to DV2: ${randSuffix}`,
        sourceLocationArn: sourceLocation1Arn,
        description: `testing using all DEA APIs for migration, using sourceLocation1 to dataVault2`,
        destinationFolder: `filesFromSL1`,
      }
    );

    // All files from SL2 go to destination folder filesFromSL2
    const taskDv2Sl3 = await createDataVaultTaskSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVault2.ulid,
      tasksToCleanUp,
      {
        name: `DEA API Migration SL3 to DV2: ${randSuffix}`,
        sourceLocationArn: sourceLocation3Arn,
        description: `testing using all DEA APIs for migration, using sourceLocation3 to dataVault2`,
        destinationFolder: `filesFromSL3`,
      }
    );

    // 3. Execute the tasks
    const dv1Sl1ExecutionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, taskDv1Sl1.taskId, {
        taskArn: taskDv1Sl1.taskArn,
      })
    ).executionId;
    const dv1Sl2ExecutionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, taskDv1Sl2.taskId, {
        taskArn: taskDv1Sl2.taskArn,
      })
    ).executionId;
    const dv2Sl1ExecutionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, taskDv2Sl1.taskId, {
        taskArn: taskDv2Sl1.taskArn,
      })
    ).executionId;
    const dv2Sl3ExecutionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, taskDv2Sl3.taskId, {
        taskArn: taskDv2Sl3.taskArn,
      })
    ).executionId;

    // Wait for executions to complete
    const taskStatuses = await waitForTaskExecutionCompletions([
      `${taskDv1Sl1.taskArn}/execution/${dv1Sl1ExecutionId}`,
      `${taskDv1Sl2.taskArn}/execution/${dv1Sl2ExecutionId}`,
      `${taskDv2Sl1.taskArn}/execution/${dv2Sl1ExecutionId}`,
      `${taskDv2Sl3.taskArn}/execution/${dv2Sl3ExecutionId}`,
    ]);
    if (!verifyAllExecutionsSucceeded(taskStatuses)) {
      console.log('Failed executing some tasks, printing out tasks statuses...');
      Array.from(taskStatuses.entries()).forEach((taskArn, status) => {
        console.log(`Task ${taskArn} completed with ${status}`);
      });
      throw new Error('Not all execution tasks succeeded');
    }

    // VERIFY: for Each Vault that Files are there in the correct file/folder structure
    // Verify DataVault 1 File/Folder Structure
    await verifyDataVaultFolderAndFileStructure(
      dataVault1.ulid,
      /*expectedNumFiles=*/ 7,
      new Map([
        // Root should only have 2 folders one for each task
        [
          '/',
          [
            createAssocDVFileVerificationObject('', 'filesFromSL1', dv1Sl1ExecutionId),
            createAssocDVFileVerificationObject('', 'filesFromSL2', dv1Sl2ExecutionId),
          ],
        ],
        // In filesFromSL1 Folder, should only have the 2 files
        [
          '/filesFromSL1/',
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket1,
            /*folderName=*/ '',
            /*expectedNumFiles=*/ 2,
            /*dataVaultFolderPrefix=*/ '/filesFromSL1/',
            dv1Sl1ExecutionId
          ),
        ],
        // In filesFromSL2 Folder, should have 1 root file, a folder called sl2-folder1-${randSuffix}, and a folder called sl2-folder2-${randSuffix}
        [
          '/filesFromSL2/',
          [
            createAssocDVFileVerificationObject(
              '/filesFromSL2/',
              `sl2-folder1-${randSuffix}`,
              dv1Sl2ExecutionId
            ),
            createAssocDVFileVerificationObject(
              '/filesFromSL2/',
              `sl2-folder2-${randSuffix}`,
              dv1Sl2ExecutionId
            ),
            ...createAssocDVFileVerificationObjectsForS3Files(
              sourceBucket2,
              /*folderName=*/ '',
              /*expectedNumFiles=*/ 1,
              /*dataVaultFolderPrefix=*/ '/filesFromSL2/',
              dv1Sl2ExecutionId
            ),
          ],
        ],
        // In filesFromSL2/sl2-folder1-${randSuffix} should have 1 folder called nested and 2 files
        [
          `/filesFromSL2/sl2-folder1-${randSuffix}/`,
          [
            createAssocDVFileVerificationObject(`/filesFromSL2/`, 'nested', dv1Sl2ExecutionId),
            ...createAssocDVFileVerificationObjectsForS3Files(
              sourceBucket2,
              `sl2-folder1-${randSuffix}/`,
              2,
              `/filesFromSL2/`,
              dv1Sl2ExecutionId
            ),
          ],
        ],
        // In filesFromSL2/sl2-folder1-${randSuffix}/nested there should only be one file
        [
          `/filesFromSL2/sl2-folder1-${randSuffix}/nested/`,
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket2,
            `sl2-folder1-${randSuffix}/nested/`,
            1,
            `/filesFromSL2/`,
            dv1Sl2ExecutionId
          ),
        ],
        // In filesFromSL2/sl2-folder2-${randSuffix}/ there should be one folder called nested
        [
          `/filesFromSL2/sl2-folder2-${randSuffix}/`,
          [createAssocDVFileVerificationObject(`/filesFromSL2/`, 'nested', dv1Sl2ExecutionId)],
        ],
        // In filesFromSL2/sl2-folder2-${randSuffix}/nested there should be one file
        [
          `/filesFromSL2/sl2-folder2-${randSuffix}/nested/`,
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket2,
            `sl2-folder2-${randSuffix}/nested/`,
            1,
            `/filesFromSL2/`,
            dv1Sl2ExecutionId
          ),
        ],
      ])
    );

    // Verify DataVault 2 File/Folder Structure
    await verifyDataVaultFolderAndFileStructure(
      dataVault2.ulid,
      /*expectedNumFiles=*/ 6,
      new Map([
        // Root should only have 2 folders one for each task
        [
          '/',
          [
            createAssocDVFileVerificationObject('', 'filesFromSL1', dv2Sl1ExecutionId),
            createAssocDVFileVerificationObject('', 'filesFromSL3', dv2Sl3ExecutionId),
          ],
        ],
        // In filesFromSL1 Folder, should only have the 2 files
        [
          '/filesFromSL1/',
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket1,
            /*folderName=*/ '',
            /*expectedNumFiles=*/ 2,
            /*dataVaultFolderPrefix=*/ '/filesFromSL1/',
            dv2Sl1ExecutionId
          ),
        ],
        // In filesFromSl3 Folder, should only have 2 folders
        [
          '/filesFromSL3/',
          [
            createAssocDVFileVerificationObject(
              '/filesFromSL3/',
              `sl3-folder1-${randSuffix}`,
              dv2Sl3ExecutionId
            ),
            createAssocDVFileVerificationObject(
              '/filesFromSL3/',
              `sl3-folder2-${randSuffix}`,
              dv2Sl3ExecutionId
            ),
          ],
        ],
        // In filesFromSL3/sl3-folder1-${randSuffix} should only have 2 files
        [
          `/filesFromSL3/sl3-folder1-${randSuffix}/`,
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket3,
            `sl3-folder1-${randSuffix}/`,
            2,
            `/filesFromSL3/`,
            dv2Sl3ExecutionId
          ),
        ],
        // In filesFromSL3/sl3-folder2-${randSuffix} should only have 2 files
        [
          `/filesFromSL3/sl3-folder2-${randSuffix}/`,
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket3,
            `sl3-folder2-${randSuffix}/`,
            2,
            `/filesFromSL3/`,
            dv2Sl3ExecutionId
          ),
        ],
      ])
    );

    // 4. Create 2 cases
    const case1 = await createCaseSuccess(
      deaApiUrl,
      {
        name: `DEA API MDI Test Case 1 ${randSuffix}`,
      },
      idToken,
      creds
    );
    casesToCleanup.set(case1.ulid ?? fail(), case1.name ?? fail());
    const case2 = await createCaseSuccess(
      deaApiUrl,
      {
        name: `DEA API MDI Test Case 2 ${randSuffix}`,
      },
      idToken,
      creds
    );
    casesToCleanup.set(case2.ulid ?? fail(), case2.name ?? fail());

    // 5. Test Create Case Associations (certain files in each vault to each case)
    // add the following files to both cases sl2-rootfile-${randSuffix}, sl3-folder1-${randSuffix}/file1, /filesFromSL3/sl3-folder2-${randSuffix}/file2
    const fileUlidsFromDV1AssocToBothCases = await getDataVaultFilesByPathAndName(
      dataVault1.ulid,
      /*filePaths=*/ ['/filesFromSL2/'],
      /*fileNames*/ [`sl2-rootfile-${randSuffix}`]
    );
    expect(fileUlidsFromDV1AssocToBothCases.length).toBe(1);
    const assoc1 = await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault1.ulid, {
      caseUlids: [case1.ulid, case2.ulid],
      fileUlids: fileUlidsFromDV1AssocToBothCases.map((file) => file.ulid),
    });
    verifyCreateCaseAssociationResponse(fileUlidsFromDV1AssocToBothCases, assoc1, /*numCases=*/ 2);
    const fileUlidsFromDV2AssocToBothCases = await getDataVaultFilesByPathAndName(
      dataVault2.ulid,
      /*filePaths=*/ [`/filesFromSL3/sl3-folder1-${randSuffix}/`, `/filesFromSL3/sl3-folder2-${randSuffix}/`],
      /*fileNames*/ [`sl3-folder1file1-${randSuffix}`, `sl3-folder2file2-${randSuffix}`]
    );
    const assoc2 = await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault2.ulid, {
      caseUlids: [case1.ulid, case2.ulid],
      fileUlids: fileUlidsFromDV2AssocToBothCases.map((file) => file.ulid),
    });
    verifyCreateCaseAssociationResponse(fileUlidsFromDV2AssocToBothCases, assoc2, /*numCases=*/ 2);
    // file1 was migrated to both dv1 and dv2, try to assign that file from both data vaults to a case1
    // the second association should fail since they have the same name
    const file1FromDV1 = await getDataVaultFilesByPathAndName(
      dataVault1.ulid,
      /*filePaths=*/ ['/filesFromSL1/'],
      /*fileNames=*/ [`sl1-file1-${randSuffix}`]
    );
    const assoc3 = await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault1.ulid, {
      caseUlids: [case1.ulid],
      fileUlids: file1FromDV1.map((file) => file.ulid),
    });
    verifyCreateCaseAssociationResponse(file1FromDV1, assoc3, /*numCases=*/ 1);
    const file1FromDV2 = await getDataVaultFilesByPathAndName(
      dataVault2.ulid,
      /*filePaths=*/ ['/filesFromSL1/'],
      /*fileNames=*/ [`sl1-file1-${randSuffix}`]
    );
    // VERIFY: Expect this to FAIL because a file of the same name has already been added to the case
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}datavaults/${dataVault2.ulid}/caseAssociations`,
          'POST',
          idToken,
          creds,
          {
            caseUlids: [case1.ulid],
            fileUlids: file1FromDV2.map((file) => file.ulid),
          }
        )
      ).status
    ).toBe(400);

    // Add files from the same Data Vault Folder to case 2
    const justCase2Files = await getDataVaultFilesByPathAndName(
      dataVault1.ulid,
      /*filePaths=*/ [`/filesFromSL2/sl2-folder1-${randSuffix}/`, `/filesFromSL2/sl2-folder1-${randSuffix}/`],
      /*fileNames=*/ [`sl2-folder1file2-${randSuffix}`, `sl2-folder1file1-${randSuffix}`]
    );
    const assoc5 = await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault1.ulid, {
      caseUlids: [case2.ulid],
      fileUlids: justCase2Files.map((file) => file.ulid),
    });
    verifyCreateCaseAssociationResponse(justCase2Files, assoc5, /*numCases=*/ 1);

    // VERIFY: Case Folder/File Structure
    // Verify Case 1 Folder/File Structure
    const case1Files = await verifyCaseFolderAndFileStructure(
      case1.ulid,
      /*expectedNumFiles=*/ 4,
      /*expectedCaseFolderFileStructure*/ new Map([
        // Root Folder should only have 3 folders
        ['/', [{ fileName: 'filesFromSL1' }, { fileName: 'filesFromSL2' }, { fileName: 'filesFromSL3' }]],
        // From filesFromSL1/ should only have a file called file1, (the other association failed)
        ['/filesFromSL1/', [convertDvFileToCaseFileVerificationObject(file1FromDV1[0])]],
        // From filesFromSL2/ should only have a file
        ['/filesFromSL2/', convertDvFilesToCaseFileVerificationObjects(fileUlidsFromDV1AssocToBothCases)],
        // From filesFromSL3/ should only have 2 folders
        [
          '/filesFromSL3/',
          [{ fileName: `sl3-folder1-${randSuffix}` }, { fileName: `sl3-folder2-${randSuffix}` }],
        ],
        // From filesFromSL3/sl3-folder1-${randSuffix} should only have a file
        [
          `/filesFromSL3/sl3-folder1-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[0])],
        ],
        // From filesFromSL3/sl3-folder2-${randSuffix} should only have a file
        [
          `/filesFromSL3/sl3-folder2-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[1])],
        ],
      ])
    );

    // Verify Case 2 Folder/File Structure
    const case2Files = await verifyCaseFolderAndFileStructure(
      case2.ulid,
      /*expectedNumFiles=*/ 5,
      /*expectedCaseFolderFileStructure*/ new Map([
        // Root Folder should only have 2 folders
        ['/', [{ fileName: 'filesFromSL2' }, { fileName: 'filesFromSL3' }]],
        // From filesFromSL2/ should only have a file and a folder
        [
          '/filesFromSL2/',
          [
            { fileName: `sl2-folder1-${randSuffix}` },
            ...convertDvFilesToCaseFileVerificationObjects(fileUlidsFromDV1AssocToBothCases),
          ],
        ],
        // From filesFromSL2/sl2-folder1-${randSuffix}/ should only have 2 files
        [
          `/filesFromSL2/sl2-folder1-${randSuffix}/`,
          convertDvFilesToCaseFileVerificationObjects(justCase2Files),
        ],
        // From filesFromSL3/ should only have 2 folders
        [
          '/filesFromSL3/',
          [{ fileName: `sl3-folder1-${randSuffix}` }, { fileName: `sl3-folder2-${randSuffix}` }],
        ],
        // From filesFromSL3/sl3-folder1-${randSuffix} should only have a file
        [
          `/filesFromSL3/sl3-folder1-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[0])],
        ],
        // From filesFromSL3/sl3-folder2-${randSuffix} should only have a file
        [
          `/filesFromSL3/sl3-folder2-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[1])],
        ],
      ])
    );

    // VERIFY: For each Data Vault File Associated, verify the case count and ScopedDeaCases are correct
    const dataVaultFileToCasesMap: Map<DeaDataVaultFile, DeaCase[]> = new Map([
      [fileUlidsFromDV1AssocToBothCases[0], [case1, case2]],
      [fileUlidsFromDV2AssocToBothCases[0], [case1, case2]],
      [fileUlidsFromDV2AssocToBothCases[1], [case1, case2]],
      [file1FromDV1[0], [case1]],
      [justCase2Files[0], [case2]],
      [justCase2Files[1], [case2]],
    ]);
    for (const [file, cases] of dataVaultFileToCasesMap.entries()) {
      await verifyDataVaultFileCaseAssociationsUpdated(file, cases);
    }

    // VERIFY: Download case files and verify the hashes
    const allCaseFiles = new Set(...case1Files.values(), ...case2Files.values());
    const downloadVerifications = [];
    for (const caseFile of allCaseFiles) {
      downloadVerifications.push(downloadCaseFileAndValidateHash(caseFile));
    }
    await Promise.all(downloadVerifications);

    // 6. Delete case association for File sl2-rootfile-${randSuffix} from Case 1 and 2
    const fileToDisassociate = fileUlidsFromDV1AssocToBothCases[0];
    await deleteCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault1.ulid, fileToDisassociate.ulid, {
      caseUlids: [case1.ulid, case2.ulid],
    });
    // VERIFY: Case File Objects for case 1 and 2 have decreased by 1 to become 3 and 4 respectively
    expect((await describeCaseSuccess(deaApiUrl, case1.ulid, idToken, creds)).objectCount).toBe(3);
    expect((await describeCaseSuccess(deaApiUrl, case2.ulid, idToken, creds)).objectCount).toBe(4);
    // VERIFY: Describe Case File fails for both cases
    const case1File1Ulid = getCaseFileUlid(
      case1Files,
      fileToDisassociate.filePath,
      fileToDisassociate.fileName
    );
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${case1.ulid}/files/${case1File1Ulid}/info`,
          'GET',
          idToken,
          creds
        )
      ).status
    ).toBe(404);
    const case2File1Ulid = getCaseFileUlid(
      case2Files,
      fileToDisassociate.filePath,
      fileToDisassociate.fileName
    );
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${case2.ulid}/files/${case2File1Ulid}/info`,
          'GET',
          idToken,
          creds
        )
      ).status
    ).toBe(404);
    // VERIFY: Get DataVaultFile Object, scopedcases is empty
    await verifyUpdatedCasesForDataVaultFile(fileToDisassociate, /*cases=*/ []);

    // 7. Delete case association from only case 1, case 2 association should still exist
    const file2ToDisassociate = fileUlidsFromDV2AssocToBothCases[0];
    await deleteCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault2.ulid, file2ToDisassociate.ulid, {
      caseUlids: [case1.ulid],
    });
    // VERIFY: Case File Objects for case 1 has decreased by 1 to become 2, case 2 file objects stays the same
    expect((await describeCaseSuccess(deaApiUrl, case1.ulid, idToken, creds)).objectCount).toBe(2);
    expect((await describeCaseSuccess(deaApiUrl, case2.ulid, idToken, creds)).objectCount).toBe(4);
    // VERIFY: Describe Case File fails for case 1, and passes for case2
    const case1File2Ulid = getCaseFileUlid(
      case1Files,
      file2ToDisassociate.filePath,
      file2ToDisassociate.fileName
    );
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${case1.ulid}/files/${case1File2Ulid}/info`,
          'GET',
          idToken,
          creds
        )
      ).status
    ).toBe(404);
    const case2File2Ulid = getCaseFileUlid(
      case2Files,
      file2ToDisassociate.filePath,
      file2ToDisassociate.fileName
    );
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${case2.ulid}/files/${case2File2Ulid}/info`,
          'GET',
          idToken,
          creds
        )
      ).status
    ).toBe(200);
    // VERIFY: Get DataVaultFile Object, scopedcases is only case 2
    await verifyUpdatedCasesForDataVaultFile(file2ToDisassociate, /*cases=*/ [case2]);

    // 8. Verify Case Structure after Dissociations
    // Verify Case 1 Folder/File Structure
    await verifyCaseFolderAndFileStructure(
      case1.ulid,
      /*expectedNumFiles=*/ 2,
      /*expectedCaseFolderFileStructure*/ new Map([
        // Root Folder should only have 2 folders (Files from Sl2 should be removed due to dissaociation)
        ['/', [{ fileName: 'filesFromSL1' }, { fileName: 'filesFromSL3' }]],
        // From filesFromSL1/ should only have a file called file1, (the other association failed)
        ['/filesFromSL1/', [convertDvFileToCaseFileVerificationObject(file1FromDV1[0])]],
        // From filesFromSL3/ should only have 1 folder (the other had one file that was dissociated)
        ['/filesFromSL3/', [{ fileName: `sl3-folder2-${randSuffix}` }]],
        // From filesFromSL3/sl3-folder2-${randSuffix} should only have a file
        [
          `/filesFromSL3/sl3-folder2-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[1])],
        ],
      ])
    );

    // Verify Case 2 Folder/File Structure
    await verifyCaseFolderAndFileStructure(
      case2.ulid,
      /*expectedNumFiles=*/ 4,
      /*expectedCaseFolderFileStructure*/ new Map([
        // Root Folder should only have 2 folders
        ['/', [{ fileName: 'filesFromSL2' }, { fileName: 'filesFromSL3' }]],
        // From filesFromSL2/ should only have a folder (The file was disassociated)
        ['/filesFromSL2/', [{ fileName: `sl2-folder1-${randSuffix}` }]],
        // From filesFromSL2/sl2-folder1-${randSuffix}/ should only have 2 files
        [
          `/filesFromSL2/sl2-folder1-${randSuffix}/`,
          convertDvFilesToCaseFileVerificationObjects(justCase2Files),
        ],
        // From filesFromSL3/ should only have 2 folders
        [
          '/filesFromSL3/',
          [{ fileName: `sl3-folder1-${randSuffix}` }, { fileName: `sl3-folder2-${randSuffix}` }],
        ],
        // From filesFromSL3/sl3-folder1-${randSuffix} should only have a file
        [
          `/filesFromSL3/sl3-folder1-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[0])],
        ],
        // From filesFromSL3/sl3-folder2-${randSuffix} should only have a file
        [
          `/filesFromSL3/sl3-folder2-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[1])],
        ],
      ])
    );
  }, 3000000);

  /* Test Mass Data Ingestion Workflow Mimicking the Console Process (using DataSync SDK)
  1. Create 2 Data Vaults (DEA API)
     VERIFY
       -- Call ListDataVaults, see both vaults are there
  2. Create Destination Locations (DATA SYNC SDK)
  3. Create Data Sync Tasks for each vault (DATA SYNC SDK) [choose which folders to move]
  4. Execute the Tasks (DEA API)
     VERIFY
       -- Query DataSync For Execution Statuses, ensure all finished with status SUCCESS
       -- Verify the Data Vault Folder/File Structure for both data vaults (BFS Tree Traversal)
  5. Create 2 Cases (DEA API)
  6. Create Case Associations for various Data Vault Files (DEA API)
     VERIFY
       -- Verify the Case Folder/File Structure for both cases
       -- For Each File Associated, verify the case count and ScopedCases has been updated by calling GetDataVaultFileDetails
       -- Download the case files and verify the hash matches the hash of the source object
  7. Delete Case Association from Both Cases (DEA API)
     VERIFY
       -- Verify the Case File Objects decreased by 1 for both cases
       -- Verify DescribeCaseFileDetails fail for the file for both cases
       -- GetDataVaultFile shows 0 case count and no scoped cases info
  8. Delete Case Association from Case1 but not from Case2 (DEA API)
      VERIFY
       -- Case File Objects decreased by 1 for Case1, but Case2 stays the same
       -- DescribeCaseFileDetails fail for the file for Case1
       -- DescribeCaseFileDetails succeeds for the file for Case2
       -- GetDataVaultFile shows 1 case count and only case2 shows up in scoped cases
  9. Reverify Case Folder/File Structure for Both Cases after Disassociations
  */
  it('performs data ingestion mimicking the console process and case association', async () => {
    // 1. Create 2 Data Vaults (DEA API)
    const dataVault1 = await createDataVaultSuccess(
      deaApiUrl,
      {
        name: `Console Process E2E Test ${randSuffix}: Vault1`,
      },
      idToken,
      creds
    );
    const dataVault2 = await createDataVaultSuccess(
      deaApiUrl,
      {
        name: `Console Process E2E Test${randSuffix}: Vault2`,
      },
      idToken,
      creds
    );

    // VERIFY: List Data Vaults, assert those data vaults are in there
    const dataVaults = (await listDataVaultsSuccess(deaApiUrl, idToken, creds)).dataVaults;
    expect(dataVaults.filter((vault) => vault.ulid === dataVault1.ulid).length).toBe(1);
    expect(dataVaults.filter((vault) => vault.ulid === dataVault2.ulid).length).toBe(1);

    // 2. Create Destination Locations (DATA SYNC SDK)
    // We will put SL1 into its own folder for DV1
    const destinationLocation1 = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      DATASETS_BUCKET_ARN,
      `/DATAVAULT${dataVault1.ulid}/fromSL1`
    );
    // We will put SL2 into its own folder for DV2
    const destinationLocation2 = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      DATASETS_BUCKET_ARN,
      `/DATAVAULT${dataVault1.ulid}/fromSL2`
    );
    // We will put SL1 and 3 into the same folder for DV2
    const destinationLocation3 = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      DATASETS_BUCKET_ARN,
      `/DATAVAULT${dataVault2.ulid}/fromSLs1and3`
    );

    // 3. Create Data Sync Tasks for each vault (DATA SYNC SDK)
    // SL1 to DV1 in its own folder
    const taskDv1Sl1Arn = await createDataSyncTaskWithSDKSuccess(
      `DataSyncProcessTestSL1DV1 ${randSuffix}`,
      sourceLocation1Arn,
      destinationLocation1,
      tasksToCleanUp
    );
    // SL2 to DV1 in its own folder
    const taskDv1Sl2Arn = await createDataSyncTaskWithSDKSuccess(
      `DataSyncProcessTestSL2DV1 ${randSuffix}`,
      sourceLocation2Arn,
      destinationLocation2,
      tasksToCleanUp
    );
    // We will put SL1 and 3 into the same folder for DV2
    const taskDv2Sl1Arn = await createDataSyncTaskWithSDKSuccess(
      `DataSyncProcessTestSL1DV2 ${randSuffix}`,
      sourceLocation1Arn,
      destinationLocation3,
      tasksToCleanUp
    );
    const taskDv2Sl3Arn = await createDataSyncTaskWithSDKSuccess(
      `DataSyncProcessTestSL3DV2 ${randSuffix}`,
      sourceLocation3Arn,
      destinationLocation3,
      tasksToCleanUp
    );

    // Get the task ids
    const taskDv1Sl1TaskId = taskDv1Sl1Arn.split('/')[1];
    const taskDv1Sl2TaskId = taskDv1Sl2Arn.split('/')[1];
    const taskDv2Sl1TaskId = taskDv2Sl1Arn.split('/')[1];
    const taskDv2Sl3TaskId = taskDv2Sl3Arn.split('/')[1];

    // 4. Execute the Tasks (DEA API)
    const dv1Sl1ExecutionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, taskDv1Sl1TaskId, {
        taskArn: taskDv1Sl1Arn,
      })
    ).executionId;
    const dv1Sl2ExecutionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, taskDv1Sl2TaskId, {
        taskArn: taskDv1Sl2Arn,
      })
    ).executionId;
    const dv2Sl1ExecutionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, taskDv2Sl1TaskId, {
        taskArn: taskDv2Sl1Arn,
      })
    ).executionId;
    const dv2Sl3ExecutionId = (
      await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, taskDv2Sl3TaskId, {
        taskArn: taskDv2Sl3Arn,
      })
    ).executionId;

    // Wait for executions to complete
    const taskStatuses = await waitForTaskExecutionCompletions([
      `${taskDv1Sl1Arn}/execution/${dv1Sl1ExecutionId}`,
      `${taskDv1Sl2Arn}/execution/${dv1Sl2ExecutionId}`,
      `${taskDv2Sl1Arn}/execution/${dv2Sl1ExecutionId}`,
      `${taskDv2Sl3Arn}/execution/${dv2Sl3ExecutionId}`,
    ]);
    if (!verifyAllExecutionsSucceeded(taskStatuses)) {
      console.log('Failed executing some tasks, printing out tasks statuses...');
      Array.from(taskStatuses.entries()).forEach((taskArn, status) => {
        console.log(`Task ${taskArn} completed with ${status}`);
      });
      throw new Error('Not all execution tasks succeeded');
    }

    // VERIFY: for Each Vault that Files are there in the correct file/folder structure
    // Verify DataVault 1 File/Folder Structure
    await verifyDataVaultFolderAndFileStructure(
      dataVault1.ulid,
      /*expectedNumFiles=*/ 7,
      new Map([
        // Root should only have 2 folders one for each task
        [
          '/',
          [
            createAssocDVFileVerificationObject('', 'fromSL1', dv1Sl1ExecutionId),
            createAssocDVFileVerificationObject('', 'fromSL2', dv1Sl2ExecutionId),
          ],
        ],
        // In fromSL1 Folder, should only have the 2 files
        [
          '/fromSL1/',
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket1,
            /*folderName=*/ '',
            /*expectedNumFiles=*/ 2,
            /*dataVaultFolderPrefix=*/ '/fromSL1/',
            dv1Sl1ExecutionId
          ),
        ],
        // In fromSL2 Folder, should have 1 root file, a folder called sl2-folder1-${randSuffix}, and a folder called sl2-folder2-${randSuffix}
        [
          '/fromSL2/',
          [
            createAssocDVFileVerificationObject('/fromSL2/', `sl2-folder1-${randSuffix}`, dv1Sl2ExecutionId),
            createAssocDVFileVerificationObject('/fromSL2/', `sl2-folder2-${randSuffix}`, dv1Sl2ExecutionId),
            ...createAssocDVFileVerificationObjectsForS3Files(
              sourceBucket2,
              /*folderName=*/ '',
              /*expectedNumFiles=*/ 1,
              /*dataVaultFolderPrefix=*/ '/fromSL2/',
              dv1Sl2ExecutionId
            ),
          ],
        ],
        // In fromSL2/sl2-folder1-${randSuffix} should have 1 folder called nested and 2 files
        [
          `/fromSL2/sl2-folder1-${randSuffix}/`,
          [
            createAssocDVFileVerificationObject(`/fromSL2/`, 'nested', dv1Sl2ExecutionId),
            ...createAssocDVFileVerificationObjectsForS3Files(
              sourceBucket2,
              `sl2-folder1-${randSuffix}/`,
              2,
              `/fromSL2/`,
              dv1Sl2ExecutionId
            ),
          ],
        ],
        // In fromSL2/sl2-folder1-${randSuffix}/nested there should only be one file
        [
          `/fromSL2/sl2-folder1-${randSuffix}/nested/`,
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket2,
            `sl2-folder1-${randSuffix}/nested/`,
            1,
            `/fromSL2/`,
            dv1Sl2ExecutionId
          ),
        ],
        // In fromSL2/sl2-folder2-${randSuffix}/ there should be one folder called nested
        [
          `/fromSL2/sl2-folder2-${randSuffix}/`,
          [createAssocDVFileVerificationObject(`/fromSL2/`, 'nested', dv1Sl2ExecutionId)],
        ],
        // In fromSL2/sl2-folder2-${randSuffix}/nested there should be one file
        [
          `/fromSL2/sl2-folder2-${randSuffix}/nested/`,
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket2,
            `sl2-folder2-${randSuffix}/nested/`,
            1,
            `/fromSL2/`,
            dv1Sl2ExecutionId
          ),
        ],
      ])
    );

    // Verify DataVault 2 File/Folder Structure
    await verifyDataVaultFolderAndFileStructure(
      dataVault2.ulid,
      /*expectedNumFiles=*/ 6,
      new Map([
        // Root should only have 1 folders (both tasks go to the same one)
        [
          '/',
          [
            // dont specify execution id, because it could be either execution3 or execution4
            createAssocDVFileVerificationObject('', 'fromSLs1and3', /*executionId=*/ undefined),
          ],
        ],
        // In fromSLs1and3 Folder, should only have the 2 files from SL1 and 2 folders from SL3
        [
          '/fromSLs1and3/',
          [
            createAssocDVFileVerificationObject(
              '/fromSLs1and3/',
              `sl3-folder1-${randSuffix}`,
              dv2Sl3ExecutionId
            ),
            createAssocDVFileVerificationObject(
              '/fromSLs1and3/',
              `sl3-folder2-${randSuffix}`,
              dv2Sl3ExecutionId
            ),
            ...createAssocDVFileVerificationObjectsForS3Files(
              sourceBucket1,
              /*folderName=*/ '',
              /*expectedNumFiles=*/ 2,
              /*dataVaultFolderPrefix=*/ '/fromSLs1and3/',
              dv2Sl1ExecutionId
            ),
          ],
        ],
        // In fromSLs1and3/sl3-folder1-${randSuffix} should only have 2 files
        [
          `/fromSLs1and3/sl3-folder1-${randSuffix}/`,
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket3,
            `sl3-folder1-${randSuffix}/`,
            2,
            `/fromSLs1and3/`,
            dv2Sl3ExecutionId
          ),
        ],
        // In fromSLs1and3/sl3-folder2-${randSuffix} should only have 2 files
        [
          `/fromSLs1and3/sl3-folder2-${randSuffix}/`,
          createAssocDVFileVerificationObjectsForS3Files(
            sourceBucket3,
            `sl3-folder2-${randSuffix}/`,
            2,
            `/fromSLs1and3/`,
            dv2Sl3ExecutionId
          ),
        ],
      ])
    );

    // 5. Create 2 Cases (DEA API)
    const case1 = await createCaseSuccess(
      deaApiUrl,
      {
        name: `Console Process MDI Test Case 1 ${randSuffix}`,
      },
      idToken,
      creds
    );
    casesToCleanup.set(case1.ulid ?? fail(), case1.name ?? fail());
    const case2 = await createCaseSuccess(
      deaApiUrl,
      {
        name: `Console Process Test Case 2 ${randSuffix}`,
      },
      idToken,
      creds
    );
    casesToCleanup.set(case2.ulid ?? fail(), case2.name ?? fail());

    // 6. Create Case Associations for various Data Vault Files (DEA API)
    // add the following files to both cases sl2-rootfile-${randSuffix}, sl3-folder1-${randSuffix}/file1, /fromSLs1and3/sl3-folder2-${randSuffix}/file2
    const fileUlidsFromDV1AssocToBothCases = await getDataVaultFilesByPathAndName(
      dataVault1.ulid,
      /*filePaths=*/ ['/fromSL2/'],
      /*fileNames*/ [`sl2-rootfile-${randSuffix}`]
    );
    expect(fileUlidsFromDV1AssocToBothCases.length).toBe(1);
    const assoc1 = await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault1.ulid, {
      caseUlids: [case1.ulid, case2.ulid],
      fileUlids: fileUlidsFromDV1AssocToBothCases.map((file) => file.ulid),
    });
    verifyCreateCaseAssociationResponse(fileUlidsFromDV1AssocToBothCases, assoc1, /*numCases=*/ 2);
    const fileUlidsFromDV2AssocToBothCases = await getDataVaultFilesByPathAndName(
      dataVault2.ulid,
      /*filePaths=*/ [`/fromSLs1and3/sl3-folder1-${randSuffix}/`, `/fromSLs1and3/sl3-folder2-${randSuffix}/`],
      /*fileNames*/ [`sl3-folder1file1-${randSuffix}`, `sl3-folder2file2-${randSuffix}`]
    );
    const assoc2 = await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault2.ulid, {
      caseUlids: [case1.ulid, case2.ulid],
      fileUlids: fileUlidsFromDV2AssocToBothCases.map((file) => file.ulid),
    });
    verifyCreateCaseAssociationResponse(fileUlidsFromDV2AssocToBothCases, assoc2, /*numCases=*/ 2);
    // file1 was migrated to both dv1 and dv2, try to assign that file from both data vaults to a case1
    // the second association should fail since they have the same name
    const file1FromDV1 = await getDataVaultFilesByPathAndName(
      dataVault1.ulid,
      /*filePaths=*/ ['/fromSL1/'],
      /*fileNames=*/ [`sl1-file1-${randSuffix}`]
    );
    const assoc3 = await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault1.ulid, {
      caseUlids: [case1.ulid],
      fileUlids: file1FromDV1.map((file) => file.ulid),
    });
    verifyCreateCaseAssociationResponse(file1FromDV1, assoc3, /*numCases=*/ 1);

    // Add files from the same Data Vault Folder to case 2
    const justCase2Files = await getDataVaultFilesByPathAndName(
      dataVault1.ulid,
      /*filePaths=*/ [`/fromSL2/sl2-folder1-${randSuffix}/`, `/fromSL2/sl2-folder1-${randSuffix}/`],
      /*fileNames=*/ [`sl2-folder1file2-${randSuffix}`, `sl2-folder1file1-${randSuffix}`]
    );
    const assoc5 = await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault1.ulid, {
      caseUlids: [case2.ulid],
      fileUlids: justCase2Files.map((file) => file.ulid),
    });
    verifyCreateCaseAssociationResponse(justCase2Files, assoc5, /*numCases=*/ 1);

    // VERIFY: Case Folder/File Structure
    // Verify Case 1 Folder/File Structure
    const case1Files = await verifyCaseFolderAndFileStructure(
      case1.ulid,
      /*expectedNumFiles=*/ 4,
      /*expectedCaseFolderFileStructure*/ new Map([
        // Root Folder should only have 3 folders
        ['/', [{ fileName: 'fromSL1' }, { fileName: 'fromSL2' }, { fileName: 'fromSLs1and3' }]],
        // From fromSL1/ should only have a file called file1, (the other association failed)
        ['/fromSL1/', [convertDvFileToCaseFileVerificationObject(file1FromDV1[0])]],
        // From fromSL2/ should only have a file
        ['/fromSL2/', convertDvFilesToCaseFileVerificationObjects(fileUlidsFromDV1AssocToBothCases)],
        // From fromSLs1and3/ should only have 2 folders
        [
          '/fromSLs1and3/',
          [{ fileName: `sl3-folder1-${randSuffix}` }, { fileName: `sl3-folder2-${randSuffix}` }],
        ],
        // From fromSLs1and3/sl3-folder1-${randSuffix} should only have a file
        [
          `/fromSLs1and3/sl3-folder1-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[0])],
        ],
        // From fromSLs1and3/sl3-folder2-${randSuffix} should only have a file
        [
          `/fromSLs1and3/sl3-folder2-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[1])],
        ],
      ])
    );

    // Verify Case 2 Folder/File Structure
    const case2Files = await verifyCaseFolderAndFileStructure(
      case2.ulid,
      /*expectedNumFiles=*/ 5,
      /*expectedCaseFolderFileStructure*/ new Map([
        // Root Folder should only have 2 folders
        ['/', [{ fileName: 'fromSL2' }, { fileName: 'fromSLs1and3' }]],
        // From filesFromSL2/ should only have a file and a folder
        [
          '/fromSL2/',
          [
            { fileName: `sl2-folder1-${randSuffix}` },
            ...convertDvFilesToCaseFileVerificationObjects(fileUlidsFromDV1AssocToBothCases),
          ],
        ],
        // From fromSL2/sl2-folder1-${randSuffix}/ should only have 2 files
        [`/fromSL2/sl2-folder1-${randSuffix}/`, convertDvFilesToCaseFileVerificationObjects(justCase2Files)],
        // From fromSLs1and3/ should only have 2 folders
        [
          '/fromSLs1and3/',
          [{ fileName: `sl3-folder1-${randSuffix}` }, { fileName: `sl3-folder2-${randSuffix}` }],
        ],
        // From fromSLs1and3/sl3-folder1-${randSuffix} should only have a file
        [
          `/fromSLs1and3/sl3-folder1-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[0])],
        ],
        // From fromSLs1and3/sl3-folder2-${randSuffix} should only have a file
        [
          `/fromSLs1and3/sl3-folder2-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[1])],
        ],
      ])
    );

    // VERIFY: For each Data Vault File Associated, verify the case count and ScopedDeaCases are correct
    const dataVaultFileToCasesMap: Map<DeaDataVaultFile, DeaCase[]> = new Map([
      [fileUlidsFromDV1AssocToBothCases[0], [case1, case2]],
      [fileUlidsFromDV2AssocToBothCases[0], [case1, case2]],
      [fileUlidsFromDV2AssocToBothCases[1], [case1, case2]],
      [file1FromDV1[0], [case1]],
      [justCase2Files[0], [case2]],
      [justCase2Files[1], [case2]],
    ]);
    for (const [file, cases] of dataVaultFileToCasesMap.entries()) {
      await verifyDataVaultFileCaseAssociationsUpdated(file, cases);
    }

    // VERIFY: Download case files and verify the hashes
    const allCaseFiles = new Set(...case1Files.values(), ...case2Files.values());
    const downloadVerifications = [];
    for (const caseFile of allCaseFiles) {
      downloadVerifications.push(downloadCaseFileAndValidateHash(caseFile));
    }
    await Promise.all(downloadVerifications);

    // 7. Delete Case Association from Both Cases (DEA API)
    const fileToDisassociate = fileUlidsFromDV1AssocToBothCases[0];
    await deleteCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault1.ulid, fileToDisassociate.ulid, {
      caseUlids: [case1.ulid, case2.ulid],
    });
    // VERIFY: Case File Objects for case 1 and 2 have decreased by 1 to become 3 and 4 respectively
    expect((await describeCaseSuccess(deaApiUrl, case1.ulid, idToken, creds)).objectCount).toBe(3);
    expect((await describeCaseSuccess(deaApiUrl, case2.ulid, idToken, creds)).objectCount).toBe(4);
    // VERIFY: Describe Case File fails for both cases
    const case1File1Ulid = getCaseFileUlid(
      case1Files,
      fileToDisassociate.filePath,
      fileToDisassociate.fileName
    );
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${case1.ulid}/files/${case1File1Ulid}/info`,
          'GET',
          idToken,
          creds
        )
      ).status
    ).toBe(404);
    const case2File1Ulid = getCaseFileUlid(
      case2Files,
      fileToDisassociate.filePath,
      fileToDisassociate.fileName
    );
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${case2.ulid}/files/${case2File1Ulid}/info`,
          'GET',
          idToken,
          creds
        )
      ).status
    ).toBe(404);
    // VERIFY: Get DataVaultFile Object, scopedcases is empty
    await verifyUpdatedCasesForDataVaultFile(fileToDisassociate, /*cases=*/ []);

    // 8. Delete Case Association from Case1 but not from Case2 (DEA API)
    const file2ToDisassociate = fileUlidsFromDV2AssocToBothCases[0];
    await deleteCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault2.ulid, file2ToDisassociate.ulid, {
      caseUlids: [case1.ulid],
    });
    // VERIFY: Case File Objects for case 1 has decreased by 1 to become 2, case 2 file objects stays the same
    expect((await describeCaseSuccess(deaApiUrl, case1.ulid, idToken, creds)).objectCount).toBe(2);
    expect((await describeCaseSuccess(deaApiUrl, case2.ulid, idToken, creds)).objectCount).toBe(4);
    // VERIFY: Describe Case File fails for case 1, and passes for case2
    const case1File2Ulid = getCaseFileUlid(
      case1Files,
      file2ToDisassociate.filePath,
      file2ToDisassociate.fileName
    );
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${case1.ulid}/files/${case1File2Ulid}/info`,
          'GET',
          idToken,
          creds
        )
      ).status
    ).toBe(404);
    const case2File2Ulid = getCaseFileUlid(
      case2Files,
      file2ToDisassociate.filePath,
      file2ToDisassociate.fileName
    );
    expect(
      (
        await callDeaAPIWithCreds(
          `${deaApiUrl}cases/${case2.ulid}/files/${case2File2Ulid}/info`,
          'GET',
          idToken,
          creds
        )
      ).status
    ).toBe(200);
    // VERIFY: Get DataVaultFile Object, scopedcases is only case 2
    await verifyUpdatedCasesForDataVaultFile(file2ToDisassociate, /*cases=*/ [case2]);

    // 9. Reverify Case Folder/File Structure for Both Cases after Disassociations
    // Verify Case 1 Folder/File Structure
    await verifyCaseFolderAndFileStructure(
      case1.ulid,
      /*expectedNumFiles=*/ 2,
      /*expectedCaseFolderFileStructure*/ new Map([
        // Root Folder should only have 2 folders (fromSl2's file was dissassociated, so the folder was deleted)
        ['/', [{ fileName: 'fromSL1' }, { fileName: 'fromSLs1and3' }]],
        // From fromSL1/ should only have a file called file1, (the other association failed)
        ['/fromSL1/', [convertDvFileToCaseFileVerificationObject(file1FromDV1[0])]],
        // From fromSLs1and3/ should only have a folder (the other folders only file was dissociated so the folder was deleted)
        ['/fromSLs1and3/', [{ fileName: `sl3-folder2-${randSuffix}` }]],
        // From fromSLs1and3/sl3-folder2-${randSuffix} should only have a file
        [
          `/fromSLs1and3/sl3-folder2-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[1])],
        ],
      ])
    );

    // Verify Case 2 Folder/File Structure
    await verifyCaseFolderAndFileStructure(
      case2.ulid,
      /*expectedNumFiles=*/ 4,
      /*expectedCaseFolderFileStructure*/ new Map([
        // Root Folder should only have 2 folders (fromSL2 stays around since it still has a folder in it though the root file was dissassociated)
        ['/', [{ fileName: 'fromSL2' }, { fileName: 'fromSLs1and3' }]],
        // From filesFromSL2/ should only have a folder (file was dissociated)
        ['/fromSL2/', [{ fileName: `sl2-folder1-${randSuffix}` }]],
        // From fromSL2/sl2-folder1-${randSuffix}/ should only have 2 files
        [`/fromSL2/sl2-folder1-${randSuffix}/`, convertDvFilesToCaseFileVerificationObjects(justCase2Files)],
        // From fromSLs1and3/ should only have 2 folders
        [
          '/fromSLs1and3/',
          [{ fileName: `sl3-folder1-${randSuffix}` }, { fileName: `sl3-folder2-${randSuffix}` }],
        ],
        // From fromSLs1and3/sl3-folder1-${randSuffix} should only have a file
        [
          `/fromSLs1and3/sl3-folder1-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[0])],
        ],
        // From fromSLs1and3/sl3-folder2-${randSuffix} should only have a file
        [
          `/fromSLs1and3/sl3-folder2-${randSuffix}/`,
          [convertDvFileToCaseFileVerificationObject(fileUlidsFromDV2AssocToBothCases[1])],
        ],
      ])
    );
  }, 3000000);

  it('updates a data vault', async () => {
    // Create Data Vault
    const preUpdateName = `Update Data Vault Test: Pre Update ${Date.now()}`;
    const dataVault = await createDataVaultSuccess(
      deaApiUrl,
      {
        name: preUpdateName,
        // no description
      },
      idToken,
      creds
    );

    // Get Details for Data Vault
    const queriedDataVault = await describeDataVaultDetailsSuccess(deaApiUrl, idToken, creds, dataVault.ulid);
    // Verify it matches what was created
    verifyDataVault(
      queriedDataVault,
      preUpdateName,
      /*descrition=*/ undefined,
      dataVault.created,
      /*updated=*/ dataVault.created,
      /*objectCount=*/ 0,
      /*totalSizeBytes=*/ 0
    );

    // Update the Vault
    const postUpdateName = `Update Data Vault Test: Post Update ${Date.now()}`;
    const description = 'Data Vault created for the Update Data Vault E2E Test';
    const updatedVaultResponse = await updateDataVaultSuccess(
      deaApiUrl,
      dataVault.ulid,
      {
        name: postUpdateName,
        description,
        ulid: dataVault.ulid,
      },
      idToken,
      creds
    );

    // Get Details for Updated Data Vault
    const updatedDataVault = await describeDataVaultDetailsSuccess(deaApiUrl, idToken, creds, dataVault.ulid);

    verifyDataVault(
      updatedDataVault,
      postUpdateName,
      description,
      dataVault.created,
      updatedVaultResponse.updated,
      /*objectCount=*/ 0,
      /*totalSizeBytes=*/ 0
    );
  });

  it('changes number of files in source location and re-runs task', async () => {
    // 1. Create Source Location with some files
    const bucketName = `dea-mdi-e2e-test-source-bucket-sourcefileschangetest-${randSuffix}`;
    await createS3BucketForSourceLocation(bucketName, s3BucketToObjectKeysMap);
    const sourceLocation = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      `arn:aws:s3:::${bucketName}`
    );
    // Create 3 files
    const originalNumFiles = 3;
    for (let i = 1; i <= originalNumFiles; i++) {
      await putObjectS3(
        bucketName,
        `file${i}-${randSuffix}`,
        '',
        `${bucketName}-file${i} body`,
        s3BucketToObjectKeysMap
      );
    }

    // 2. Create Data Vault
    const dataVault = await createDataVaultSuccess(
      deaApiUrl,
      {
        name: `Source Size E2ETests ${randSuffix} Vault`,
      },
      idToken,
      creds
    );

    // 3. Create Data Sync Task
    const task = await createDataVaultTaskSuccess(deaApiUrl, idToken, creds, dataVault.ulid, tasksToCleanUp, {
      name: `Source Size E2ETests ${randSuffix} Task`,
      sourceLocationArn: sourceLocation,
      description: `task for changing source size by adding and removing files E2E tests`,
    });

    // 4. Execute Task
    async function executeTask(): Promise<string> {
      const executionId = (
        await createDataVaultExecutionSuccess(deaApiUrl, idToken, creds, task.taskId, {
          taskArn: task.taskArn,
        })
      ).executionId;

      const taskStatus = await waitForTaskExecutionCompletions([`${task.taskArn}/execution/${executionId}`]);
      expect(taskStatus.size).toBe(1);
      verifyAllExecutionsSucceeded(taskStatus);

      return executionId;
    }
    const executionId1 = await executeTask();

    // 5. Verify Data Vault Structure
    const originalDvFiles = createAssocDVFileVerificationObjectsForS3Files(
      bucketName,
      /*folderName=*/ '',
      originalNumFiles,
      /*dataVaultFolderPrefix=*/ '/',
      executionId1
    );
    await verifyDataVaultFolderAndFileStructure(
      dataVault.ulid,
      originalNumFiles,
      new Map([
        // Root should only have the 3 files
        ['/', originalDvFiles],
      ])
    );

    // 6. Add some files to the the Data Vault
    const additionalFilesToAdd = 2;
    for (let i = originalNumFiles + 1; i <= originalNumFiles + additionalFilesToAdd; i++) {
      await putObjectS3(
        bucketName,
        `file${i}-${randSuffix}`,
        '',
        `${bucketName}-file${i} body`,
        s3BucketToObjectKeysMap
      );
    }

    // 7. Execute Task Again
    const executionId2 = await executeTask();
    const expectedNumFiles = originalNumFiles + additionalFilesToAdd;
    // VERIFY the new files are present
    function getSubsetOfSourceLocationFiles(
      executionId: string,
      start: number,
      end: number,
      totalNumFiles: number
    ): AssociatedDataVaultFileVerificationObject[] {
      const s3Files = getS3FilesByFolder(bucketName, /*folderName=*/ '', totalNumFiles).slice(start, end);
      return s3Files.map((s3File) =>
        createAssocDVFileVerificationObject(/*filePathPrefix=*/ '/', s3File.fileName, executionId, s3File)
      );
    }
    const addedFiles = getSubsetOfSourceLocationFiles(
      executionId2,
      /*start*/ originalNumFiles,
      /*end*/ expectedNumFiles,
      expectedNumFiles
    );
    expect(addedFiles.length).toBe(additionalFilesToAdd);
    await verifyDataVaultFolderAndFileStructure(
      dataVault.ulid,
      expectedNumFiles,
      new Map([
        // Root should only have the 5 files
        ['/', [...originalDvFiles, ...addedFiles]],
      ])
    );

    // 8. Change a file in the data vault, re-run task, verify the file not overwritten
    // Modify File
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const fileS3Key = s3BucketToObjectKeysMap.get(bucketName)![0].fileS3Key;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileS3Key,
        Body: `updated body`,
      })
    );
    // Rerun task
    await executeTask();
    // VERIFY DataVault Structure (same as last execution, nothing should have changed)
    await verifyDataVaultFolderAndFileStructure(
      dataVault.ulid,
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
    const dvFiles = await listDataVaultFilesSuccess(deaApiUrl, idToken, creds, dataVault.ulid);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const originalFile = s3BucketToObjectKeysMap.get(bucketName)![0];
    const modifiedFile = dvFiles.filter((file) => file.fileName === originalFile.fileName);
    expect(modifiedFile.length).toBe(1);
    await createCaseAssociationSuccess(deaApiUrl, idToken, creds, dataVault.ulid, {
      caseUlids: [deaCase.ulid],
      fileUlids: [modifiedFile[0].ulid],
    });
    const caseFile = (await listCaseFilesSuccess(deaApiUrl, idToken, creds, deaCase.ulid)).files;
    expect(caseFile.length).toBe(1);
    const downloadUrl = await getCaseFileDownloadUrl(
      deaApiUrl,
      idToken,
      creds,
      deaCase.ulid,
      caseFile[0].ulid
    );
    const downloadedContent = await downloadContentFromS3(downloadUrl, caseFile[0].contentType);
    expect(sha256(downloadedContent).toString()).toEqual(originalFile.sha256Hash);

    // 8. Remove the modified file from the source, re-run task
    const response = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: [{ Key: originalFile.fileS3Key }],
        },
      })
    );
    expect(response.Deleted?.length).toBe(1);
    // Remove it from the map so we don't try to delete this file twice
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    s3BucketToObjectKeysMap.get(bucketName)!.shift();
    // Rerun the task
    await executeTask();
    // VERIFY the deleted file is STILL in the data vault by calling GetDataVaultFileDetails
    await describeDataVaultFileDetailsSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVault.ulid,
      modifiedFile[0].ulid
    );
    // VERIFY Case file still exists
    await describeCaseFileDetailsSuccess(deaApiUrl, idToken, creds, deaCase.ulid, caseFile[0].ulid);
    // VERIFY Vault Structure (same as last execution, nothing should have changed)
    await verifyDataVaultFolderAndFileStructure(
      dataVault.ulid,
      expectedNumFiles,
      new Map([
        // Root should only have the 5 files
        ['/', [...originalDvFiles, ...addedFiles]],
      ])
    );
  }, 3000000);

  it('tries to execute tasks with incorrect settings', async () => {
    // Create a Data Vault and Destination Location
    const dataVault = await createDataVaultSuccess(
      deaApiUrl,
      {
        name: `IncorrectTasks E2ETest ${randSuffix} Vault`,
      },
      idToken,
      creds
    );
    const correctDestinationLocation = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      DATASETS_BUCKET_ARN,
      `/DATAVAULT${dataVault.ulid}`
    );

    const correctSourceLocation = sourceLocation1Arn;

    // Now try calling ExecuteTask (DEA API) with various incorrect settings and verify they fail

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
                      S3BucketArn:
                        input.taskReportS3Bucket ?? `arn:aws:s3:::${testEnv.DataSyncReportsBucket}`,
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
            tasksToCleanUp.push(response.TaskArn!);
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

    function changeLastLetter(arn: string): string {
      const newLastLetter = arn.charAt(arn.length - 1) === '0' ? '1' : '0';
      const newArn = arn.substring(0, arn.length - 1) + newLastLetter;
      return newArn;
    }

    // CASE: Source Location Doesn't Exist
    const incorrectSource = changeLastLetter(correctSourceLocation);
    const expectedError = `Location ${incorrectSource.split('/')[1]} is not found.`;
    await createTask(
      `Source Location does not exist ${randSuffix}`,
      { sourceLocationArn: incorrectSource },
      expectedError
    );

    // CASE: Destination Location is not the datasets bucket
    const incorrectDestinationTask = await createTask(
      `Destination is not the datasets bucket ${randSuffix}`,
      { destinationLocationArn: sourceLocation2Arn }
    );
    await createFailedExecution(incorrectDestinationTask);

    // CASE: Destination Location is not a data vault
    const nonDataVaultLocation = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      DATASETS_BUCKET_ARN,
      ``
    );
    const nonDataVaultLocationTask = await createTask(`Destination is not a data vault ${randSuffix}`, {
      destinationLocationArn: nonDataVaultLocation,
    });
    await createFailedExecution(nonDataVaultLocationTask);

    // CASE: Data Vault does not exist
    const nonExistentDataVaultUlid = `XXXXXXXXXXXXXXXXXXXXXXXXXX`;
    const nonExistentDataVaultLocation = await createS3DataSyncLocation(
      dataSyncLocationsToCleanUp,
      DATASETS_BUCKET_ARN,
      `/DATAVAULT${nonExistentDataVaultUlid}`
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
              Subdirectory: `/DATAVAULT${dataVault.ulid}`,
              S3StorageClass: S3StorageClass.STANDARD,
            })
          )
        ).LocationArn;

        if (!locationArn) {
          throw new Error('Unable to create destination location');
        }
        dataSyncLocationsToCleanUp.push(locationArn);

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

  // TODO: Implement this test
  //    it('creates 10,000 files and moves them with mass ingestion', async() => {
  // DOWNLOAD AND TEST HASH AFTER ASSIGNED TO CASE?

  //    }, 3000000);

  // TODO: When Delete Data Vault is Complete, write this test
  //    it('deletes a data vault', async() => {
  // 1. Create Data Vault
  // 2. Get Data Vault Details for Data Vault
  // 3. Delete Data Vault
  // 4. Try to get Data Vault Details, verify that it fails
  // 5. List Data Vaults, verify its not present
  //    });

  // TODO: Should we move the audit tests here?
  // Perform Ingestion and Case Association, then Audit Case, Audit User, Audit Data Vault

  function getS3FilesByFolder(
    sourceBucketName: string,
    folderName: string,
    expectedNumFiles: number
  ): SourceLocationFile[] {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const files = s3BucketToObjectKeysMap
      .get(sourceBucketName)!
      .filter((file) => file.filePath === folderName);
    expect(files.length).toBe(expectedNumFiles);
    return files;
  }

  type AssociatedDataVaultFileVerificationObject = {
    readonly fileName: string;
    readonly filePathPrefix: string;
    readonly executionId?: string;
    readonly sourceFile?: SourceLocationFile; // only defined if its a file
  };
  async function verifyDataVaultFolderAndFileStructure(
    dataVaultUlid: string,
    expectedNumFiles: number,
    expectedDataVaultFolderFileStructure: Map<string, AssociatedDataVaultFileVerificationObject[]>
  ) {
    let foundFiles = 0;
    let foldersVisited = 0;

    // Walk the data avult folder structure in BFS and verify structure
    const dvFoldersQueue: string[] = ['/']; // start at the root
    while (dvFoldersQueue.length > 0) {
      // Grab the file path from the queue
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const filePath = foldersVisited == 0 ? `${dvFoldersQueue.shift()!}` : `${dvFoldersQueue.shift()!}/`;

      // Get case contents for the queue
      const acutalDataVaultFolderContents = await listDataVaultFilesSuccess(
        deaApiUrl,
        idToken,
        creds,
        dataVaultUlid,
        filePath
      );
      foldersVisited++;

      // Find corresponding expectedContents
      const expectedContents = expectedDataVaultFolderFileStructure.get(filePath);
      if (!expectedContents) {
        throw new Error(`File path ${filePath} could not be found in expected data vault structure.`);
      }
      expect(acutalDataVaultFolderContents.length).toBe(expectedContents.length);

      // Add all case folders to the BFS queue
      const actualDVFolders = acutalDataVaultFolderContents
        .filter((obj) => !obj.isFile)
        .map((obj) => `${obj.filePath}${obj.fileName}`);
      dvFoldersQueue.push(...actualDVFolders);

      // Update number of found files
      const actualDVFiles = acutalDataVaultFolderContents.filter((obj) => obj.isFile);
      foundFiles += actualDVFiles.length;

      // verify expected folders and files vs actual contents
      verifyDataVaultFolderContents(dataVaultUlid, acutalDataVaultFolderContents, expectedContents);
    }

    // Verify that we found and verified all the case files and folders
    expect(foundFiles).toBe(expectedNumFiles);
    expect(foldersVisited).toBe(Array.from(expectedDataVaultFolderFileStructure.keys()).length);

    // Verify that the number of objects in the data vault is correct
    expect(
      (await describeDataVaultDetailsSuccess(deaApiUrl, idToken, creds, dataVaultUlid)).objectCount
    ).toBe(expectedNumFiles);
  }

  function verifyDataVaultFolderContents(
    dvUlid: string,
    actualFolderContents: DeaDataVaultFile[],
    expectedContents: AssociatedDataVaultFileVerificationObject[]
  ) {
    const expectedFolders = expectedContents.filter((obj) => !obj.sourceFile);
    const expectedFiles = expectedContents.filter((content) => !!content.sourceFile);

    const actualFolders = actualFolderContents.filter((file) => !file.isFile);
    actualFolders.forEach((actualFolder) => {
      const expectedFolder = expectedFolders.filter((obj) => obj.fileName === actualFolder.fileName);
      if (expectedFolder.length != 1) {
        console.log(`Found ${expectedFolder.length} for folder ${actualFolder.fileName} in`);
        console.log(expectedFolder);
      }
      expect(expectedFolder.length).toBe(1);
      verifyDataVaultFile(dvUlid, /*isFile=*/ false, expectedFolder[0].executionId, actualFolder);
    });
    expect(actualFolders.length).toBe(expectedFolders.length);

    const actualFiles = actualFolderContents.filter((file) => file.isFile);
    actualFiles.forEach((actualFile) => {
      const expectedFile = expectedFiles.filter((obj) => actualFile.fileName === obj.fileName);
      expect(expectedFile.length).toBe(1);
      verifyDataVaultFile(
        dvUlid,
        /*isFile=*/ true,
        expectedFile[0].executionId,
        actualFile,
        expectedFile[0].sourceFile,
        expectedFile[0].filePathPrefix
      );
    });
    expect(actualFiles.length).toBe(expectedFiles.length);
  }

  async function getDataVaultFilesByPathAndName(
    dataVaultId: string,
    filePaths: string[],
    fileNames: string[]
  ): Promise<DeaDataVaultFile[]> {
    expect(filePaths.length).toBe(fileNames.length);

    const files: DeaDataVaultFile[] = [];
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const fileName = fileNames[i];
      const dvFiles = await listDataVaultFilesSuccess(deaApiUrl, idToken, creds, dataVaultId, filePath);
      const fileMatches = dvFiles.filter((dvFile) => dvFile.fileName === fileName);

      if (fileMatches.length != 1) {
        console.log(`Failed to find file ${fileName} on ${filePath}.`);
        console.log(dvFiles);
      }
      expect(fileMatches.length).toBe(1);
      files.push(fileMatches[0]);
    }

    expect(files.length).toBe(fileNames.length);
    return files;
  }

  async function verifyDataVaultFileCaseAssociationsUpdated(
    dataVaultFile: DeaDataVaultFile,
    cases: DeaCase[]
  ) {
    const updatedDataVaultFileInfo = await describeDataVaultFileDetailsSuccess(
      deaApiUrl,
      idToken,
      creds,
      dataVaultFile.dataVaultUlid,
      dataVaultFile.ulid
    );

    expect(updatedDataVaultFileInfo.caseCount).toBe(cases.length);

    expect(updatedDataVaultFileInfo.cases).toBeDefined();
    expect(updatedDataVaultFileInfo.cases?.length).toBe(cases.length);

    for (const expectedCase of cases) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const actualCase = updatedDataVaultFileInfo.cases!.filter(
        (scopedCase) => scopedCase.ulid === expectedCase.ulid
      );
      expect(actualCase.length).toBe(1);
      expect(actualCase[0].name).toBe(expectedCase.name);
    }
  }

  async function downloadCaseFileAndValidateHash(caseFile: CaseFileDTO) {
    // Get the corresponding DataVaultFile object to get the expected hash
    // That hash will have already been verified against the original S3 object
    // Split the /filesFromSlN from the caseFile path to find the dataVaultFile path
    const dataVaultFilePath = `/${caseFile.filePath.split('/').slice(2).join('/')}`;
    const dataVaultFiles = await listDataVaultFilesSuccess(
      deaApiUrl,
      idToken,
      creds,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      caseFile.dataVaultUlid!,
      dataVaultFilePath
    );
    const dataVaultFile = dataVaultFiles.filter((file) => file.fileName === caseFile.fileName);
    expect(dataVaultFile.length).toBe(1);
    const expectedHash = dataVaultFile[0].sha256Hash;

    const downloadUrl = await getCaseFileDownloadUrl(
      deaApiUrl,
      idToken,
      creds,
      caseFile.caseUlid,
      caseFile.ulid
    );
    const downloadedContent = await downloadContentFromS3(downloadUrl, caseFile.contentType);

    expect(sha256(downloadedContent).toString()).toEqual(expectedHash);
  }

  type AssociatedCaseFileVerificationObject = {
    readonly fileName: string;
    readonly dataVaultFile?: DeaDataVaultFile; // only defined if its a file
  };
  async function verifyCaseFolderAndFileStructure(
    caseUlid: string,
    expectedNumFiles: number,
    expectedCaseFolderFileStructure: Map<string, AssociatedCaseFileVerificationObject[]>
  ): Promise<Map<string, CaseFileDTO[]>> {
    const caseFileObjects: Map<string, CaseFileDTO[]> = new Map();
    let foundFiles = 0;
    let foldersVisited = 0;

    // Walk the case folder structure in BFS and verify structure
    const caseFoldersQueue: string[] = ['/']; // start at the root
    while (caseFoldersQueue.length > 0) {
      // Grab the file path from the queue
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const filePath = foldersVisited == 0 ? `${caseFoldersQueue.shift()!}` : `${caseFoldersQueue.shift()!}/`;

      // Get case contents for the queue
      const actualCaseFolderContents = (
        await listCaseFilesSuccess(deaApiUrl, idToken, creds, caseUlid, filePath)
      ).files;
      foldersVisited++;

      // Find corresponding expectedContents
      const expectedContents = expectedCaseFolderFileStructure.get(filePath);
      if (!expectedContents) {
        throw new Error(`Case path ${filePath} could not be found in expected case structure.`);
      }
      expect(actualCaseFolderContents.length).toBe(expectedContents.length);

      // Add all case folders to the BFS queue
      const actualCaseFolders = actualCaseFolderContents
        .filter((obj) => !obj.isFile)
        .map((obj) => `${obj.filePath}${obj.fileName}`);
      caseFoldersQueue.push(...actualCaseFolders);

      // Add all case file objects to the map to be returned
      const actualCaseFiles = actualCaseFolderContents.filter((obj) => obj.isFile);
      foundFiles += actualCaseFiles.length;
      caseFileObjects.set(filePath, actualCaseFiles);

      // verify expected folders and files vs actual contents
      verifyCaseFolderContents(actualCaseFolderContents, expectedContents);
    }

    // Verify that we found and verified all the case files and folders
    expect(foundFiles).toBe(expectedNumFiles);
    expect(foldersVisited).toBe(Array.from(expectedCaseFolderFileStructure.keys()).length);

    // Verify that the number of objects in the case is correct
    expect((await describeCaseSuccess(deaApiUrl, caseUlid, idToken, creds)).objectCount).toBe(
      expectedNumFiles
    );

    return caseFileObjects;
  }

  function verifyCaseFolderContents(
    caseFolderContents: CaseFileDTO[],
    expectedContents: AssociatedCaseFileVerificationObject[]
  ) {
    const expectedFolders = expectedContents.filter((obj) => !obj.dataVaultFile).map((obj) => obj.fileName);
    const expectedFiles: DeaDataVaultFile[] = expectedContents
      .map((content) => content.dataVaultFile)
      .filter((dvFile): dvFile is DeaDataVaultFile => !!dvFile);

    const actualFolders = caseFolderContents.filter((file) => !file.isFile);
    actualFolders.forEach((folder) => {
      const expectedFolder = expectedFolders.filter((obj) => obj === folder.fileName);
      if (expectedFolder.length != 1) {
        console.log(`Found ${expectedFolder.length} for folder ${folder.fileName} in`);
        console.log(caseFolderContents);
      }
      expect(expectedFolder.length).toBe(1);
    });
    expect(actualFolders.length).toBe(expectedFolders.length);

    const actualFiles = caseFolderContents.filter((file) => file.isFile);
    actualFiles.forEach((actualFile) => {
      const expectedFile = expectedFiles.filter((obj) => actualFile.fileName === obj.fileName);
      expect(expectedFile.length).toBe(1);
      verifyCaseFileFromDataVault(actualFile, expectedFile[0]);
    });
    expect(actualFiles.length).toBe(expectedFiles.length);
  }

  function getCaseFileUlid(
    caseFiles: Map<string, CaseFileDTO[]>,
    filePath: string,
    fileName: string
  ): string {
    const files = caseFiles.get(filePath);
    if (!files) {
      throw new Error(`Could not find file path ${filePath} in case file objects`);
    }
    const matches = files.filter((file) => file.fileName === fileName);
    if (matches.length != 1) {
      throw new Error(`Found ${matches.length} files with ${filePath}/${fileName} in case file objects`);
    }
    return matches[0].ulid;
  }

  async function verifyUpdatedCasesForDataVaultFile(oldFile: DeaDataVaultFile, cases: DeaCase[]) {
    const newDataVaultFile = await describeDataVaultFileDetailsSuccess(
      deaApiUrl,
      idToken,
      creds,
      oldFile.dataVaultUlid,
      oldFile.ulid
    );
    verifyDataVaultFile(
      oldFile.dataVaultUlid,
      /*isFile=*/ true,
      oldFile.executionId,
      newDataVaultFile,
      /*sourceLocationFile=*/ undefined,
      /*dataVaultFolderPrefix=*/ undefined,
      /*caseCount=*/ cases.length,
      /*scopedCases=*/ cases
    );
  }

  function createAssocDVFileVerificationObject(
    filePathPrefix: string,
    fileName: string,
    executionId?: string,
    sourceFile?: SourceLocationFile
  ): AssociatedDataVaultFileVerificationObject {
    return {
      fileName,
      filePathPrefix,
      executionId,
      sourceFile,
    };
  }

  function createAssocDVFileVerificationObjectsForS3Files(
    sourceBucket: string,
    folderName: string,
    expectedNumFiles: number,
    filePathPrefix: string,
    executionId: string
  ): AssociatedDataVaultFileVerificationObject[] {
    const s3Files = getS3FilesByFolder(sourceBucket, folderName, expectedNumFiles);
    return s3Files.map((s3File) =>
      createAssocDVFileVerificationObject(filePathPrefix, s3File.fileName, executionId, s3File)
    );
  }

  function convertDvFileToCaseFileVerificationObject(
    dvFile: DeaDataVaultFile
  ): AssociatedCaseFileVerificationObject {
    return {
      fileName: dvFile.fileName,
      dataVaultFile: dvFile,
    };
  }

  function convertDvFilesToCaseFileVerificationObjects(
    dvFiles: DeaDataVaultFile[]
  ): AssociatedCaseFileVerificationObject[] {
    return dvFiles.map((dvFile) => convertDvFileToCaseFileVerificationObject(dvFile));
  }
});

function verifyDataVault(
  vault: DeaDataVault,
  name: string,
  description?: string,
  created?: Date,
  updated?: Date,
  objectCount?: number,
  totalSizeBytes?: number
) {
  expect(vault.name).toStrictEqual(name);

  if (!description) {
    expect(vault.description).toBeUndefined();
  } else {
    expect(vault.description).toStrictEqual(description);
  }

  expect(vault.created).toBeDefined();
  if (created) {
    expect(vault.created).toEqual(created);
  }

  expect(vault.updated).toBeDefined();
  if (updated) {
    expect(vault.updated).toEqual(updated);
  }

  expect(vault.objectCount).toBe(objectCount);
  expect(vault.totalSizeBytes).toBe(totalSizeBytes);
}

function verifyDataVaultFile(
  dataVaultUlid: string,
  isFile: boolean,
  executionId?: string,
  dataVaultFile?: DeaDataVaultFile,
  sourceLocationFile?: SourceLocationFile,
  dataVaultFolderPrefix?: string,
  caseCount?: number,
  cases?: DeaCase[]
) {
  expect(dataVaultFile).toBeDefined();

  expect(dataVaultFile?.dataVaultUlid).toStrictEqual(dataVaultUlid);
  if (executionId) {
    expect(dataVaultFile?.executionId).toStrictEqual(executionId);
  }
  expect(dataVaultFile?.isFile).toBe(isFile);

  if (sourceLocationFile) {
    expect(dataVaultFile?.fileName).toStrictEqual(sourceLocationFile.fileName);
    expect(dataVaultFile?.filePath).toStrictEqual(`${dataVaultFolderPrefix}${sourceLocationFile.filePath}`);
    expect(dataVaultFile?.sha256Hash?.split(':')[1]).toStrictEqual(sourceLocationFile.sha256Hash);
  }

  if (caseCount) {
    expect(dataVaultFile?.caseCount).toBe(caseCount);
  }

  if (cases) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const dvCases = dataVaultFile!.cases!;
    expect(dvCases.length).toBe(cases.length);
    cases.forEach((expectedCase) => {
      const foundCases = dvCases.filter(
        (scopedCase) => scopedCase.ulid === expectedCase.ulid && scopedCase.name === expectedCase.name
      );
      expect(foundCases.length).toBe(1);
    });
  }

  expect(dataVaultFile?.createdBy).toStrictEqual('MassDataIngestion TestUser');
}

function verifyCreateCaseAssociationResponse(
  dataVaultFiles: DeaDataVaultFile[],
  filesTransferred: DeaCaseFileResult[],
  numberOfCases: number
) {
  expect(dataVaultFiles.length * numberOfCases).toBe(filesTransferred.length);
  dataVaultFiles.forEach((dataVaultFile) => {
    // find corresponding transfered file
    const caseFileMatches = filesTransferred.filter(
      (file) => file.filePath === dataVaultFile.filePath && file.fileName === dataVaultFile.fileName
    );
    expect(caseFileMatches.length).toBe(numberOfCases);
    caseFileMatches.forEach((caseFile) => verifyCaseFileFromDataVault(caseFile, dataVaultFile));
  });
}

function verifyCaseFileFromDataVault(caseFile: CaseFileDTO, dataVaultFile: DeaDataVaultFile) {
  expect(caseFile.fileName).toStrictEqual(dataVaultFile.fileName);
  expect(caseFile.filePath).toStrictEqual(dataVaultFile.filePath);

  expect(caseFile.dataVaultUlid).toBeDefined();
  expect(caseFile.dataVaultUlid).toStrictEqual(dataVaultFile.dataVaultUlid);

  expect(caseFile.isFile).toBe(dataVaultFile.isFile);
  expect(caseFile.fileSizeBytes).toBe(dataVaultFile.fileSizeBytes);
  expect(caseFile.sha256Hash).toStrictEqual(dataVaultFile.sha256Hash);
  expect(caseFile.executionId).toStrictEqual(dataVaultFile.executionId);

  // TODO: verify created by is the ulid of our user
}

const createS3BucketForSourceLocation = async (
  name: string,
  s3BucketToObjectKeysMap: Map<string, SourceLocationFile[]>
): Promise<void> => {
  await s3Client.send(
    new CreateBucketCommand({
      Bucket: name,
    })
  );

  s3BucketToObjectKeysMap.set(name, []);
};

type SourceLocationFile = {
  readonly fileName: string;
  readonly filePath: string;
  readonly sha256Hash: string;
  readonly fileS3Key: string;
};

const putObjectS3 = async (
  bucketName: string,
  fileName: string,
  filePath: string,
  body: string,
  s3BucketToObjectKeysMap: Map<string, SourceLocationFile[]>
): Promise<void> => {
  const fileS3Key = `${filePath}${fileName}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileS3Key,
      Body: body,
    })
  );

  const sha256Hash = sha256(body).toString();

  s3BucketToObjectKeysMap.get(bucketName)?.push({
    fileName,
    filePath,
    fileS3Key,
    sha256Hash,
  });
};

const deleteSourceObjects = async (bucket: string, files: SourceLocationFile[]) => {
  const objectsToDelete: ObjectIdentifier[] = [];
  files.forEach((files) => objectsToDelete.push({ Key: files.fileS3Key }));
  try {
    const response = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: objectsToDelete,
        },
      })
    );
    console.log(`Removed ${response.Deleted?.length} objects from bucket ${bucket}`);
  } catch (e) {
    console.log(`Error removing objects from bucket ${bucket}`);
  }
};

const deleteBucket = async (bucketName: string) => {
  await s3Client.send(
    new DeleteBucketCommand({
      Bucket: bucketName,
    })
  );

  console.log(`Removed bucket ${bucketName}`);
};
