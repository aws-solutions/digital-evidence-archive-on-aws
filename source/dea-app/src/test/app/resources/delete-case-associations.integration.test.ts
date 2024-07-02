/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { createCaseAssociation } from '../../../app/resources/create-case-association';
import { createDataVault } from '../../../app/resources/create-data-vault';
import { LambdaProviders } from '../../../app/resources/dea-gateway-proxy-handler';
import { deleteCaseAssociation } from '../../../app/resources/delete-case-association';
import { getCase } from '../../../app/resources/get-case-details';
import { listDataVaultFilesByFilePath } from '../../../app/services/data-vault-file-service';
import { DeaCase, DeaCaseInput } from '../../../models/case';
import { DeaDataVaultFile } from '../../../models/data-vault-file';
import { DeaUser } from '../../../models/user';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { createCase } from '../../../persistence/case';
import { createDataVaultFile } from '../../../persistence/data-vault-file';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';
import { callListCaseFiles } from './case-file-integration-test-helper';
import { dataVaultFileGenerate, dataVaultFolderGenerate } from './data-vault-integration-test-helper';

describe('test data vault file disassociation from cases', () => {
  let repositoryProvider: ModelRepositoryProvider;
  let testProviders: LambdaProviders;
  let user: DeaUser;

  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('dataVaultFileDisassociationTestsTable');
    testProviders = createTestProvidersObject({ repositoryProvider });

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

  it('should remove the association from the cases', async () => {
    const name = 'dataVaultFileTest';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(event, dummyContext, testProviders);
    const newDataVault = await JSON.parse(response.body);

    // Add files to data vault
    const pathsToGenerate = ['/nestedFolder/folder2/'];

    const totalFiles = [];

    for (const path of pathsToGenerate) {
      const generatedFiles = dataVaultFileGenerate(2, path, newDataVault.ulid, user.ulid);
      totalFiles.push(...generatedFiles);
    }
    totalFiles.push(dataVaultFolderGenerate('nestedFolder', '/', newDataVault.ulid, user.ulid));
    totalFiles.push(dataVaultFolderGenerate('folder2', '/nestedFolder/', newDataVault.ulid, user.ulid));

    await createDataVaultFile(totalFiles, repositoryProvider);

    // Get files from root directory
    const pageOfDataVaultFiles: Paged<DeaDataVaultFile> = await listDataVaultFilesByFilePath(
      newDataVault.ulid,
      '/',
      10000,
      repositoryProvider,
      undefined
    );

    const rootFolderUlids = pageOfDataVaultFiles.map((file) => file.ulid);

    // Create the association
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
      testProviders
    );

    expect(caseAssociateResponse.statusCode).toEqual(200);
    expect(JSON.parse(caseAssociateResponse.body).filesTransferred.length).toEqual(4); // (2 files) * 2 cases

    // Check cases root directory for number of files
    const caseFiles1 = await callListCaseFiles(user.ulid, testProviders, createdCase.ulid, '30', '/');
    expect(caseFiles1.files.length).toEqual(1);

    const caseFiles2 = await callListCaseFiles(user.ulid, testProviders, createdCase2.ulid, '30', '/');
    expect(caseFiles2.files.length).toEqual(1);

    // Check cases /nestedFolder/folder2 directory for number of files
    const caseFilesNested = await callListCaseFiles(
      user.ulid,
      testProviders,
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

    const caseResponse = await getCase(caseEvent, dummyContext, testProviders);

    expect(caseResponse.statusCode).toEqual(200);

    if (!caseResponse.body) {
      fail();
    }

    const retrievedCase: DeaCase = jsonParseWithDates(caseResponse.body);
    expect(retrievedCase.objectCount).toEqual(2);

    // Get data vault files
    const pageOfDataVaultFiles2: Paged<DeaDataVaultFile> = await listDataVaultFilesByFilePath(
      newDataVault.ulid,
      '/nestedFolder/folder2/',
      30,
      repositoryProvider,
      undefined
    );

    // Delete case associations for the first file
    const dataVaultFile1 = pageOfDataVaultFiles2[0];
    await deleteCaseAssociation(
      getDummyEvent({
        pathParameters: {
          dataVaultId: newDataVault.ulid,
          fileId: dataVaultFile1.ulid,
        },
        body: JSON.stringify({
          caseUlids: [createdCase.ulid, createdCase2.ulid],
        }),
      }),
      dummyContext,
      testProviders
    );

    // Check cases at /nestedFolder/folder2 directory. 1 file expected.
    const caseFilesAfterRemovingFirstAssociation = await callListCaseFiles(
      user.ulid,
      testProviders,
      createdCase.ulid,
      '30',
      '/nestedFolder/folder2/'
    );
    expect(caseFilesAfterRemovingFirstAssociation.files.length).toEqual(1);

    // Delete case associations for the second file
    const dataVaultFile2 = pageOfDataVaultFiles2[1];
    await deleteCaseAssociation(
      getDummyEvent({
        pathParameters: {
          dataVaultId: newDataVault.ulid,
          fileId: dataVaultFile2.ulid,
        },
        body: JSON.stringify({
          caseUlids: [createdCase.ulid, createdCase2.ulid],
        }),
      }),
      dummyContext,
      testProviders
    );

    // Check cases at root directory for number of files. Must be empty.
    const caseFilesAfterRemovingSecondAssociation = await callListCaseFiles(
      user.ulid,
      testProviders,
      createdCase.ulid,
      '30',
      '/'
    );
    expect(caseFilesAfterRemovingSecondAssociation.files.length).toEqual(0);
  }, 40000);

  it('should fail for a missing data vault id', async () => {
    const caseAssociateEvent = getDummyEvent({
      pathParameters: {
        fileId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
      body: JSON.stringify({
        caseUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
      }),
    });
    await expect(deleteCaseAssociation(caseAssociateEvent, dummyContext, testProviders)).rejects.toThrow(
      "Required path param 'dataVaultId' is missing."
    );
  }, 40000);

  it('should fail for a missing file id', async () => {
    const caseAssociateEvent = getDummyEvent({
      pathParameters: {
        dataVaultId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
      body: JSON.stringify({
        caseUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
      }),
    });
    await expect(deleteCaseAssociation(caseAssociateEvent, dummyContext, testProviders)).rejects.toThrow(
      "Required path param 'fileId' is missing."
    );
  }, 40000);

  it('should fail if case ulids are missing', async () => {
    const deleteCaseAssociateEvent = getDummyEvent({
      pathParameters: {
        dataVaultId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
        fileId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
      body: JSON.stringify({
        dummyUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
      }),
    });

    deleteCaseAssociateEvent.headers['userUlid'] = user.ulid;

    await expect(
      deleteCaseAssociation(deleteCaseAssociateEvent, dummyContext, testProviders)
    ).rejects.toThrow('caseUlids" is required');
  });

  it('should fail for a data vault id that does not exist', async () => {
    const dataVaultId = 'AAAAAAAAAAAAAAAAAAAAAAAAAA';
    await expect(
      deleteCaseAssociation(
        getDummyEvent({
          pathParameters: {
            dataVaultId,
            fileId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
          },
          body: JSON.stringify({
            caseUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
          }),
        }),
        dummyContext,
        testProviders
      )
    ).rejects.toThrow(`DataVault not found.`);
  }, 40000);

  it('should fail for a data vault file id that does not exist', async () => {
    const name = 'dataVaultEmptyTest';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(event, dummyContext, testProviders);
    const newDataVault = await JSON.parse(response.body);
    await expect(
      deleteCaseAssociation(
        getDummyEvent({
          pathParameters: {
            dataVaultId: newDataVault.ulid,
            fileId: 'AAAAAAAAAAAAAAAAAAAAAAAAAA',
          },
          body: JSON.stringify({
            caseUlids: ['AAAAAAAAAAAAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAAAAAA'],
          }),
        }),
        dummyContext,
        testProviders
      )
    ).rejects.toThrow(`DataVault File not found.`);
  }, 40000);

  it('should fail for a data vault file non associated to a case', async () => {
    // Create data vault
    const name = 'dataVaultWithFileTest';
    const event = getDummyEvent({
      body: JSON.stringify({
        name,
      }),
    });
    const response = await createDataVault(event, dummyContext, testProviders);
    const newDataVault = await JSON.parse(response.body);

    //Adds a file to the data vault
    const generatedFiles = dataVaultFileGenerate(1, '/', newDataVault.ulid, user.ulid);
    const dataVaultFile = await createDataVaultFile([generatedFiles[0]], repositoryProvider);

    // Create empty case
    const theCase: DeaCaseInput = {
      name: 'An empty case',
    };
    const createdCase = await createCase(theCase, user, repositoryProvider);
    await expect(
      deleteCaseAssociation(
        getDummyEvent({
          pathParameters: {
            dataVaultId: newDataVault.ulid,
            fileId: dataVaultFile[0].ulid,
          },
          body: JSON.stringify({
            caseUlids: [createdCase.ulid],
          }),
        }),
        dummyContext,
        testProviders
      )
    ).rejects.toThrow(`Could not find file`);
  }, 40000);
});
