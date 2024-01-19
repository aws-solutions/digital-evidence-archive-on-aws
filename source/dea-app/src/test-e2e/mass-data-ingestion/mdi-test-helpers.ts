/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ObjectIdentifier,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Credentials } from 'aws4-axios';
import { enc } from 'crypto-js';
import sha256 from 'crypto-js/sha256';
import { Oauth2Token } from '../../models/auth';
import { DeaCase } from '../../models/case';
import { CaseFileDTO, DeaCaseFileResult } from '../../models/case-file';
import { DeaDataVault } from '../../models/data-vault';
import { DeaDataVaultFile } from '../../models/data-vault-file';
import { testEnv } from '../helpers/settings';
import {
  cleanupDataSyncTestResources,
  createS3DataSyncLocation,
  describeDataVaultDetailsSuccess,
  describeDataVaultFileDetailsSuccess,
  listDataVaultFilesSuccess,
} from '../resources/support/datavault-support';
import {
  cleanupCaseAndFiles,
  describeCaseSuccess,
  downloadContentFromS3,
  getCaseFileDownloadUrl,
  listCaseFilesSuccess,
} from '../resources/test-helpers';

export const s3Client = new S3Client({ region: testEnv.awsRegion });
const deaApiUrl = testEnv.apiUrlOutput;

export const DATASETS_BUCKET_ARN = `arn:aws:s3:::${testEnv.datasetsBucketName}`;
// NOTE: Do Not change the source bucket 'dea-mdi-e2e-test-source-bucket' prefix,
// since it is hard coded into the DataSync Role when deployed as a testing stack
export const SOURCE_BUCKET_PREFIX = 'dea-mdi-e2e-test-source-bucket';

export type SourceLocation = {
  readonly bucketName: string;
  readonly locationArn: string;
  readonly files: SourceLocationFile[];
};

export type SourceLocationFile = {
  readonly fileName: string;
  readonly filePath: string;
  readonly sha256Hash: string;
  readonly fileS3Key: string;
};

export class MdiTestHelper {
  readonly suffix: string; // Used to differentiate between runs since names for data vaults/users have to be unique
  readonly testUser: string;

  private sourceLocations: SourceLocation[] = [];

  readonly tasksToCleanUp: string[] = [];
  readonly dataSyncLocationsToCleanUp: string[] = [];
  readonly casesToCleanup: Map<string, string> = new Map();
  // TODO: when data vaults can be deleted, make sure we clean up resources so
  // as to not clutter up the deployment when we run this multiple times
  // const dataVaultsToDelete: string[] = [];

  public constructor(testUser: string, suffix: string) {
    this.testUser = `${testUser}${suffix}`;
    this.suffix = suffix;
  }

  public async cleanup(creds: Credentials, idToken: Oauth2Token) {
    // Clean up cases and case files
    for (const [caseUlid, caseName] of this.casesToCleanup.entries()) {
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
    for (const sourceLocation of this.sourceLocations) {
      if (sourceLocation.files.length > 0) {
        await deleteSourceObjects(sourceLocation.bucketName, sourceLocation.files);
      }
      await deleteBucket(sourceLocation.bucketName);
    }

    await cleanupDataSyncTestResources(this.tasksToCleanUp, this.dataSyncLocationsToCleanUp);
  }

  public async addSourceLocation(name: string): Promise<SourceLocation> {
    const bucketName = `${SOURCE_BUCKET_PREFIX}-${name}-${this.suffix}`;
    // Create the S3 Bucket
    await s3Client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
      })
    );

    // Create the Source Location
    const locationArn = await this.createLocationForBucket(`arn:aws:s3:::${bucketName}`);

    // Add to list of source locations
    const sourceLocation = {
      bucketName,
      locationArn,
      files: [],
    };
    this.sourceLocations.push(sourceLocation);
    return sourceLocation;
  }

  public async addSourceFile(
    fileName: string,
    filePath: string,
    body: string,
    sourceLocation: SourceLocation
  ) {
    const fileS3Key = `${filePath}${fileName}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: sourceLocation.bucketName,
        Key: fileS3Key,
        Body: body,
      })
    );

    const sha256Hash = sha256(body).toString(enc.Base64);

    sourceLocation.files.push({
      fileName,
      filePath,
      fileS3Key,
      sha256Hash,
    });
  }

  public async createLocationForBucket(bucketArn: string, folder?: string): Promise<string> {
    return await createS3DataSyncLocation(this.dataSyncLocationsToCleanUp, bucketArn, folder);
  }

  public async createDestinationLocation(dataVaultUlid: string, folder?: string): Promise<string> {
    return await createS3DataSyncLocation(
      this.dataSyncLocationsToCleanUp,
      DATASETS_BUCKET_ARN,
      `/DATAVAULT${dataVaultUlid}${folder}`
    );
  }

  private getS3FilesByFolder(
    sourceLocation: SourceLocation,
    folderName: string,
    expectedNumFiles: number
  ): SourceLocationFile[] {
    const files = sourceLocation.files.filter((file) => file.filePath === folderName);
    expect(files.length).toBe(expectedNumFiles);
    return files;
  }

  public createAssocDVFileVerificationObjectsForS3Files(
    sourceLocation: SourceLocation,
    folderName: string,
    expectedNumFiles: number,
    filePathPrefix: string,
    executionId: string
  ): AssociatedDataVaultFileVerificationObject[] {
    const s3Files = this.getS3FilesByFolder(sourceLocation, folderName, expectedNumFiles);
    return s3Files.map((s3File) =>
      createAssocDVFileVerificationObject(filePathPrefix, s3File.fileName, executionId, s3File)
    );
  }
}

// ------------------ Verification Helpers ------------------

export function verifyDataVault(
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

export function verifyDataVaultFile(
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
    expect(dataVaultFile?.sha256Hash).toStrictEqual(sourceLocationFile.sha256Hash);
  }

  if (caseCount) {
    expect(dataVaultFile?.caseCount).toBe(caseCount);
  }

  if (cases) {
    const dvCases = dataVaultFile!.cases!;
    expect(dvCases.length).toBe(cases.length);
    cases.forEach((expectedCase) => {
      const foundCases = dvCases.filter(
        (scopedCase) => scopedCase.ulid === expectedCase.ulid && scopedCase.name === expectedCase.name
      );
      expect(foundCases.length).toBe(1);
    });
  }
}

export function verifyCreateCaseAssociationResponse(
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

export async function verifyDataVaultFileCaseAssociationsUpdated(
  idToken: Oauth2Token,
  creds: Credentials,
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
    const actualCase = updatedDataVaultFileInfo.cases!.filter(
      (scopedCase) => scopedCase.ulid === expectedCase.ulid
    );
    expect(actualCase.length).toBe(1);
    expect(actualCase[0].name).toBe(expectedCase.name);
  }
}

export async function downloadCaseFileAndValidateHash(
  idToken: Oauth2Token,
  creds: Credentials,
  caseFile: CaseFileDTO
) {
  // Get the corresponding DataVaultFile object to get the expected hash
  // That hash will have already been verified against the original S3 object
  // Split the /filesFromSlN from the caseFile path to find the dataVaultFile path
  const dataVaultFilePath = `/${caseFile.filePath.split('/').slice(2).join('/')}`;
  const dataVaultFiles = await listDataVaultFilesSuccess(
    deaApiUrl,
    idToken,
    creds,
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

  expect(sha256(downloadedContent).toString(enc.Base64)).toEqual(expectedHash);
}

// ------------------ Data Vault File/Folder Helpers ------------------

export function verifyCaseFileFromDataVault(caseFile: CaseFileDTO, dataVaultFile: DeaDataVaultFile) {
  expect(caseFile.fileName).toStrictEqual(dataVaultFile.fileName);
  expect(caseFile.filePath).toStrictEqual(dataVaultFile.filePath);

  expect(caseFile.dataVaultUlid).toBeDefined();
  expect(caseFile.dataVaultUlid).toStrictEqual(dataVaultFile.dataVaultUlid);

  expect(caseFile.isFile).toBe(dataVaultFile.isFile);
  expect(caseFile.fileSizeBytes).toBe(dataVaultFile.fileSizeBytes);
  expect(caseFile.sha256Hash).toStrictEqual(dataVaultFile.sha256Hash);
  expect(caseFile.executionId).toStrictEqual(dataVaultFile.executionId);
}

export type AssociatedDataVaultFileVerificationObject = {
  readonly fileName: string;
  readonly filePathPrefix: string;
  readonly executionId?: string;
  readonly sourceFile?: SourceLocationFile; // only defined if its a file
};

export async function verifyDataVaultFolderAndFileStructure(
  idToken: Oauth2Token,
  creds: Credentials,
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
  expect((await describeDataVaultDetailsSuccess(deaApiUrl, idToken, creds, dataVaultUlid)).objectCount).toBe(
    expectedNumFiles
  );
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

export async function getDataVaultFilesByPathAndName(
  idToken: Oauth2Token,
  creds: Credentials,
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

// ------------------ Case Association Helpers ------------------
export function createAssocDVFileVerificationObject(
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

export function convertDvFileToCaseFileVerificationObject(
  dvFile: DeaDataVaultFile
): AssociatedCaseFileVerificationObject {
  return {
    fileName: dvFile.fileName,
    dataVaultFile: dvFile,
  };
}

export function convertDvFilesToCaseFileVerificationObjects(
  dvFiles: DeaDataVaultFile[]
): AssociatedCaseFileVerificationObject[] {
  return dvFiles.map((dvFile) => convertDvFileToCaseFileVerificationObject(dvFile));
}

// ------------------ Case File/Folder Helpers ------------------
export type AssociatedCaseFileVerificationObject = {
  readonly fileName: string;
  readonly dataVaultFile?: DeaDataVaultFile; // only defined if its a file
};

export async function verifyCaseFolderAndFileStructure(
  idToken: Oauth2Token,
  creds: Credentials,
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
  expect((await describeCaseSuccess(deaApiUrl, caseUlid, idToken, creds)).objectCount).toBe(expectedNumFiles);

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

export async function verifyUpdatedCasesForDataVaultFile(
  idToken: Oauth2Token,
  creds: Credentials,
  oldFile: DeaDataVaultFile,
  cases: DeaCase[]
) {
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

export function getCaseFileUlid(
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

// ------------------ S3 Cleanup Helpers ------------------
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
    console.log(`Error removing objects from bucket ${bucket}`, e);
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
