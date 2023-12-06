/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import { Oauth2Token } from '../../models/auth';
import { DeaCase } from '../../models/case';
import { DeaDataVaultFile } from '../../models/data-vault-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  createCaseAssociationSuccess,
  createDataSyncTaskWithSDKSuccess,
  createDataVaultSuccess,
  createDataVaultExecutionSuccess,
  deleteCaseAssociationSuccess,
  listDataVaultsSuccess,
  verifyAllExecutionsSucceeded,
  waitForTaskExecutionCompletions,
} from '../resources/support/datavault-support';
import {
  callDeaAPIWithCreds,
  createCaseSuccess,
  describeCaseSuccess,
  randomSuffix,
} from '../resources/test-helpers';
import {
  convertDvFilesToCaseFileVerificationObjects,
  convertDvFileToCaseFileVerificationObject,
  createAssocDVFileVerificationObject,
  getCaseFileUlid,
  getDataVaultFilesByPathAndName,
  downloadCaseFileAndValidateHash,
  MdiTestHelper,
  SourceLocation,
  verifyCaseFolderAndFileStructure,
  verifyCreateCaseAssociationResponse,
  verifyDataVaultFileCaseAssociationsUpdated,
  verifyDataVaultFolderAndFileStructure,
  verifyUpdatedCasesForDataVaultFile,
} from './mdi-test-helpers';

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

describe('mass data ingestion e2e tests mimicking the data sync console process', () => {
  const cognitoHelper = new CognitoHelper();
  const randSuffix = randomSuffix();

  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  const mdiTestHelper = new MdiTestHelper(`ConsoleMDITestUser`, randSuffix);

  let sourceLocation1: SourceLocation;
  let sourceLocation2: SourceLocation;
  let sourceLocation3: SourceLocation;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(mdiTestHelper.testUser, 'WorkingManager', 'ConsoleMDI', 'MDITestUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    // Create 3 S3 Buckets, (Will be used as source locations) and create files in each
    // see comment at top of file for S3 object/folder structure

    // Location 1 has 2 root files
    sourceLocation1 = await mdiTestHelper.addSourceLocation('console-loc1');
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl1-file1-${randSuffix}`,
      /*filePath=*/ '',
      /*body=*/ `${sourceLocation1.bucketName}-file1 body`,
      sourceLocation1
    );
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl1-file2-${randSuffix}`,
      /*filePath=*/ '',
      /*body=*/ `${sourceLocation1.bucketName}-file2 body`,
      sourceLocation1
    );

    sourceLocation2 = await mdiTestHelper.addSourceLocation('console-loc2');
    // root file
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl2-rootfile-${randSuffix}`,
      /*filePath=*/ '',
      /*body=*/ `${sourceLocation2.bucketName}-root file body`,
      sourceLocation2
    );
    // Put some nested folders
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl2-folder1file1-${randSuffix}`,
      /*filePath=*/ `sl2-folder1-${randSuffix}/`,
      /*body=*/ `/folder1/folder1file1 body`,
      sourceLocation2
    );
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl2-folder1file2-${randSuffix}`,
      /*filePath=*/ `sl2-folder1-${randSuffix}/`,
      /*body=*/ `/folder1/file2 body`,
      sourceLocation2
    );
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl2-level2file1-${randSuffix}`,
      /*filePath=*/ `sl2-folder2-${randSuffix}/nested/`,
      /*body=*/ `/sl2-folder2-${randSuffix}/nested/level2file1 body`,
      sourceLocation2
    );
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl2-folder1nestedfile-${randSuffix}`,
      /*filePath=*/ `sl2-folder1-${randSuffix}/nested/`,
      /*body=*/ `/folder1/nested/folder1nestedfile body`,
      sourceLocation2
    );

    sourceLocation3 = await mdiTestHelper.addSourceLocation('console-loc3');
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl3-folder1file1-${randSuffix}`,
      /*filePath=*/ `sl3-folder1-${randSuffix}/`,
      /*body=*/ '/folder1/file1 body',
      sourceLocation3
    );
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl3-folder1file2-${randSuffix}`,
      /*filePath=*/ `sl3-folder1-${randSuffix}/`,
      /*body=*/ '/folder1/file2 body',
      sourceLocation3
    );
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl3-folder2file1-${randSuffix}`,
      /*filePath=*/ `sl3-folder2-${randSuffix}/`,
      /*body=*/ '/folder2/file1 body',
      sourceLocation3
    );
    await mdiTestHelper.addSourceFile(
      /*fileName=*/ `sl3-folder2file2-${randSuffix}`,
      /*filePath=*/ `sl3-folder2-${randSuffix}/`,
      /*body=*/ '/folder2/file2 body',
      sourceLocation3
    );
  }, 100000);

  afterAll(async () => {
    // Refresh creds because this is a long running test
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    await mdiTestHelper.cleanup(creds, idToken);

    await cognitoHelper.cleanup();
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
    const destinationLocation1 = await mdiTestHelper.createDestinationLocation(
      dataVault1.ulid,
      /*folder=*/ '/fromSL1'
    );
    // We will put SL2 into its own folder for DV2
    const destinationLocation2 = await mdiTestHelper.createDestinationLocation(
      dataVault1.ulid,
      /*folder=*/ '/fromSL2'
    );
    // We will put SL1 and 3 into the same folder for DV2
    const destinationLocation3 = await mdiTestHelper.createDestinationLocation(
      dataVault2.ulid,
      /*folder=*/ '/fromSLs1and3'
    );

    // 3. Create Data Sync Tasks for each vault (DATA SYNC SDK)
    // SL1 to DV1 in its own folder
    const taskDv1Sl1Arn = await createDataSyncTaskWithSDKSuccess(
      `DataSyncProcessTestSL1DV1 ${randSuffix}`,
      sourceLocation1.locationArn,
      destinationLocation1,
      mdiTestHelper.tasksToCleanUp
    );
    // SL2 to DV1 in its own folder
    const taskDv1Sl2Arn = await createDataSyncTaskWithSDKSuccess(
      `DataSyncProcessTestSL2DV1 ${randSuffix}`,
      sourceLocation2.locationArn,
      destinationLocation2,
      mdiTestHelper.tasksToCleanUp
    );
    // We will put SL1 and 3 into the same folder for DV2
    const taskDv2Sl1Arn = await createDataSyncTaskWithSDKSuccess(
      `DataSyncProcessTestSL1DV2 ${randSuffix}`,
      sourceLocation1.locationArn,
      destinationLocation3,
      mdiTestHelper.tasksToCleanUp
    );
    const taskDv2Sl3Arn = await createDataSyncTaskWithSDKSuccess(
      `DataSyncProcessTestSL3DV2 ${randSuffix}`,
      sourceLocation3.locationArn,
      destinationLocation3,
      mdiTestHelper.tasksToCleanUp
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
      idToken,
      creds,
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
          mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
            sourceLocation1,
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
            ...mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
              sourceLocation2,
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
            ...mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
              sourceLocation2,
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
          mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
            sourceLocation2,
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
          mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
            sourceLocation2,
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
      idToken,
      creds,
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
            ...mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
              sourceLocation1,
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
          mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
            sourceLocation3,
            `sl3-folder1-${randSuffix}/`,
            2,
            `/fromSLs1and3/`,
            dv2Sl3ExecutionId
          ),
        ],
        // In fromSLs1and3/sl3-folder2-${randSuffix} should only have 2 files
        [
          `/fromSLs1and3/sl3-folder2-${randSuffix}/`,
          mdiTestHelper.createAssocDVFileVerificationObjectsForS3Files(
            sourceLocation3,
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
    mdiTestHelper.casesToCleanup.set(case1.ulid ?? fail(), case1.name ?? fail());
    const case2 = await createCaseSuccess(
      deaApiUrl,
      {
        name: `Console Process Test Case 2 ${randSuffix}`,
      },
      idToken,
      creds
    );
    mdiTestHelper.casesToCleanup.set(case2.ulid ?? fail(), case2.name ?? fail());

    // 6. Create Case Associations for various Data Vault Files (DEA API)
    // add the following files to both cases sl2-rootfile-${randSuffix}, sl3-folder1-${randSuffix}/file1, /fromSLs1and3/sl3-folder2-${randSuffix}/file2
    const fileUlidsFromDV1AssocToBothCases = await getDataVaultFilesByPathAndName(
      idToken,
      creds,
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
      idToken,
      creds,
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
      idToken,
      creds,
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
      idToken,
      creds,
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
      idToken,
      creds,
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
      idToken,
      creds,
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
      await verifyDataVaultFileCaseAssociationsUpdated(idToken, creds, file, cases);
    }

    // VERIFY: Download case files and verify the hashes
    const allCaseFiles = new Set(...case1Files.values(), ...case2Files.values());
    const downloadVerifications = [];
    for (const caseFile of allCaseFiles) {
      downloadVerifications.push(downloadCaseFileAndValidateHash(idToken, creds, caseFile));
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
    await verifyUpdatedCasesForDataVaultFile(idToken, creds, fileToDisassociate, /*cases=*/ []);

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
    await verifyUpdatedCasesForDataVaultFile(idToken, creds, file2ToDisassociate, /*cases=*/ [case2]);

    // 9. Reverify Case Folder/File Structure for Both Cases after Disassociations
    // Verify Case 1 Folder/File Structure
    await verifyCaseFolderAndFileStructure(
      idToken,
      creds,
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
      idToken,
      creds,
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
});
