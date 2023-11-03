/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { createCaseAssociation } from '../../../app/resources/create-case-association';
import { createDataVault } from '../../../app/resources/create-data-vault';
import { getCase } from '../../../app/resources/get-case-details';
import {
  fetchNestedFilesInFolders,
  listDataVaultFilesByFilePath,
} from '../../../app/services/data-vault-file-service';
import { DeaCase, DeaCaseInput } from '../../../models/case';
import { DeaDataVaultFile } from '../../../models/data-vault-file';
import { DeaUser } from '../../../models/user';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { createCase } from '../../../persistence/case';
import { createDataVaultFile } from '../../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { callListCaseFiles } from './case-file-integration-test-helper';
import { dataVaultFileGenerate, dataVaultFolderGenerate } from './data-vault-integration-test-helper';

let user: DeaUser;

describe('test data vault file details', () => {
  let repositoryProvider: ModelRepositoryProvider;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataVaultFileTestsTable');
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

  it('Given a list of files, should associate files and folders to cases', async () => {
    const name = 'dataVaultFolderTest';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(event, dummyContext, repositoryProvider);
    const newDataVault = await JSON.parse(response.body);

    // Add files to data vault
    const pathsToGenerate = ['/', '/nestedFolder/', '/nestedFolder/folder2/'];

    const totalFiles = [];

    for (const path of pathsToGenerate) {
      const generatedFiles = dataVaultFileGenerate(2, path, newDataVault.ulid, user.ulid);
      totalFiles.push(...generatedFiles);
    }
    totalFiles.push(dataVaultFolderGenerate('nestedFolder', '/', newDataVault.ulid, user.ulid));
    totalFiles.push(dataVaultFolderGenerate('folder2', '/nestedFolder/', newDataVault.ulid, user.ulid));

    const filesList = [];
    for (const file of totalFiles) {
      const response = await createDataVaultFile(file, repositoryProvider);
      filesList.push(response);
    }

    // Get files from root directory
    const pageOfDataVaultFiles: Paged<DeaDataVaultFile> = await listDataVaultFilesByFilePath(
      newDataVault.ulid,
      '/',
      10000,
      repositoryProvider,
      undefined
    );

    const rootFolderUlids = pageOfDataVaultFiles.map((file) => file.ulid);

    // Create Cases and test association
    // Create 2 cases for test
    const theCase: DeaCaseInput = {
      name: 'ACaseForRetrieving',
      description: 'An initial description',
    };
    const createdCase = await createCase(theCase, user, repositoryProvider);

    const theCase2: DeaCaseInput = {
      name: 'ACaseForRetrieving2',
      description: 'An initial description',
    };
    const createdCase2 = await createCase(theCase2, user, repositoryProvider);

    const caseUlids = [createdCase.ulid, createdCase2.ulid];
    const caseAssociateEvent = getDummyEvent({
      pathParameters: {
        dataVaultId: newDataVault.ulid,
      },
      body: JSON.stringify({
        caseUlids,
        fileUlids: rootFolderUlids,
      }),
    });

    caseAssociateEvent.headers['userUlid'] = user.ulid;

    const caseAssociateResponse = await createCaseAssociation(
      caseAssociateEvent,
      dummyContext,
      repositoryProvider
    );

    expect(caseAssociateResponse.statusCode).toEqual(200);
    expect(JSON.parse(caseAssociateResponse.body).filesTransferred.length).toEqual(12); // (6 files) * 2 cases

    // Check cases root directory for number of files
    const caseFiles1 = await callListCaseFiles(user.ulid, repositoryProvider, createdCase.ulid, '30', '/');
    expect(caseFiles1.files.length).toEqual(3);

    const caseFiles2 = await callListCaseFiles(user.ulid, repositoryProvider, createdCase2.ulid, '30', '/');
    expect(caseFiles2.files.length).toEqual(3);

    // Check cases /nestedFolder/folder2 directory for number of files
    const caseFilesNested = await callListCaseFiles(
      user.ulid,
      repositoryProvider,
      createdCase.ulid,
      '30',
      '/nestedFolder/folder2/'
    );
    expect(caseFilesNested.files.length).toEqual(2);

    // Check case details for total number of files
    const caseEvent = getDummyEvent({
      pathParameters: {
        caseId: createdCase.ulid,
      },
    });

    const caseResponse = await getCase(caseEvent, dummyContext, repositoryProvider);

    expect(caseResponse.statusCode).toEqual(200);

    if (!caseResponse.body) {
      fail();
    }

    const retrievedCase: DeaCase = jsonParseWithDates(caseResponse.body);
    expect(retrievedCase.objectCount).toEqual(6);

    // Get updated files from root directory
    const pageOfDataVaultFiles2: Paged<DeaDataVaultFile> = await listDataVaultFilesByFilePath(
      newDataVault.ulid,
      '/',
      10000,
      repositoryProvider,
      undefined
    );

    // Check files for case association
    for (const file of pageOfDataVaultFiles2) {
      if (file.isFile) {
        expect(file.caseCount).toEqual(caseUlids.length);
      }
    }
  }, 40000);

  it('should check fetching nested files is working as intended', async () => {
    const name = 'dataVaultFolderTest2';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(event, dummyContext, repositoryProvider);
    const newDataVault = await JSON.parse(response.body);

    // Add files to data vault
    const pathsToGenerate = ['/', '/nestedFolder/', '/nestedFolder/folder2/'];

    const totalFiles = [];

    const filesToGenerate = 30;
    for (const path of pathsToGenerate) {
      const generatedFiles = dataVaultFileGenerate(filesToGenerate, path, newDataVault.ulid, user.ulid);
      totalFiles.push(...generatedFiles);
    }
    totalFiles.push(dataVaultFolderGenerate('nestedFolder', '/', newDataVault.ulid, user.ulid));
    totalFiles.push(dataVaultFolderGenerate('folder2', '/nestedFolder/', newDataVault.ulid, user.ulid));

    const filesList = [];
    for (const file of totalFiles) {
      const response = await createDataVaultFile(file, repositoryProvider);
      filesList.push(response);
    }

    // Get files from root directory
    const pageOfDataVaultFiles: Paged<DeaDataVaultFile> = await listDataVaultFilesByFilePath(
      newDataVault.ulid,
      '/',
      10000,
      repositoryProvider,
      undefined
    );

    const rootFolderUlids = pageOfDataVaultFiles.map((file) => file.ulid);

    const allFileUlids = await fetchNestedFilesInFolders(
      newDataVault.ulid,
      rootFolderUlids,
      10000,
      repositoryProvider
    );

    expect(allFileUlids.length).toEqual(filesToGenerate * 3);

    // Make sure pagination working and we still get all the expected ULIDS
    // with a limit of 1
    const allFileUlids2 = await fetchNestedFilesInFolders(
      newDataVault.ulid,
      rootFolderUlids,
      1,
      repositoryProvider
    );
    expect(allFileUlids2.length).toEqual(filesToGenerate * 3);
  });

  it('should fail if case ulids are missing', async () => {
    const caseAssociateEvent = getDummyEvent({
      pathParameters: {
        dataVaultId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
      body: JSON.stringify({
        dummyUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
      }),
    });

    caseAssociateEvent.headers['userUlid'] = user.ulid;

    await expect(createCaseAssociation(caseAssociateEvent, dummyContext, repositoryProvider)).rejects.toThrow(
      'caseUlids" is required'
    );
  });

  it('should fail for a data vault id that does not exist', async () => {
    const dataVaultId = '000000000000AAAAAAAAAAAAAA';
    await expect(
      createCaseAssociation(
        getDummyEvent({
          pathParameters: {
            dataVaultId,
          },
          body: JSON.stringify({
            caseUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
            fileUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
          }),
        }),
        dummyContext,
        repositoryProvider
      )
    ).rejects.toThrow(`Could not find DataVault: ${dataVaultId} in the DB`);
  }, 40000);

  it('should fail for a missing data vault id', async () => {
    const caseAssociateEvent = getDummyEvent({
      body: JSON.stringify({
        caseUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
        fileUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
      }),
    });
    await expect(createCaseAssociation(caseAssociateEvent, dummyContext, repositoryProvider)).rejects.toThrow(
      "Required path param 'dataVaultId' is missing."
    );
  }, 40000);
});
