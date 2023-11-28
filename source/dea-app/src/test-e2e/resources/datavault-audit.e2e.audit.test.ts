/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import { AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import { DataVaultFileDTO } from '../../models/data-vault-file';
import { createDataVaultFile } from '../../persistence/data-vault-file';
import { defaultProvider } from '../../persistence/schema/entities';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  createCaseAssociationSuccess,
  createDataVaultSuccess,
  describeDataVaultFileDetailsSuccess,
  listDataVaultFilesSuccess,
  listDataVaultsSuccess,
  updateDataVaultSuccess,
} from './support/datavault-support';
import {
  MINUTES_TO_MILLISECONDS,
  createCaseSuccess,
  delay,
  getAuditQueryResults,
  randomSuffix,
  s3Cleanup,
  s3Object,
  verifyAuditEntry,
} from './test-helpers';

describe('datavault and file audit e2e', () => {
  const cognitoHelper = new CognitoHelper();

  const testUser = `dataVaultAuditTestUser${randomSuffix()}`;
  const testRole = 'WorkingManager';
  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  const s3ObjectsToDelete: s3Object[] = [];

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, testRole, 'DataVaultAudit', 'TestUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
  }, 10000);

  afterAll(async () => {
    await cognitoHelper.cleanup();

    await s3Cleanup(s3ObjectsToDelete);
  }, 30000);

  it(
    'retrieves actions taken against a data vault',
    async () => {
      const caseForAssociation = await createCaseSuccess(
        deaApiUrl,
        {
          name: `caseForAssociateion${randomSuffix()}`,
          description: 'description',
        },
        idToken,
        creds
      );

      // AuditEventType.CREATE_DATA_VAULT
      // TransactWriteItems - vault
      const vaultName = `auditVaultTest${randomSuffix()}`;
      const deaDataVault = await createDataVaultSuccess(
        deaApiUrl,
        {
          name: vaultName,
          description: 'this is a description',
        },
        idToken,
        creds
      );

      const userUlid = await cognitoHelper.getUserDbId(testUser, defaultProvider);

      const fileInput: DataVaultFileDTO = {
        fileName: 'testFile',
        filePath: '/dummypath/test/test/',
        dataVaultUlid: deaDataVault.ulid,
        isFile: true,
        fileSizeBytes: 1024,
        createdBy: userUlid,
        contentType: 'regular',
        sha256Hash: 'SHA256HASH',
        versionId: 'VERSIONID',
        fileS3Key: 'S3KEY',
        executionId: 'exec-00000000000000000',
      };

      // TransactWriteItems - vault + file
      const dataVaultFile = await createDataVaultFile(fileInput, defaultProvider);

      // AuditEventType.GET_DATA_VAULT_FILE_DETAIL
      // get vault
      // db read file
      await describeDataVaultFileDetailsSuccess(
        deaApiUrl,
        idToken,
        creds,
        deaDataVault.ulid,
        dataVaultFile.ulid
      );

      // AuditEventType.UPDATE_DATA_VAULT_DETAILS
      // db get vault
      // TransactWriteItems vault
      // db get vault
      await updateDataVaultSuccess(
        deaApiUrl,
        deaDataVault.ulid,
        {
          ulid: deaDataVault.ulid,
          name: `${vaultName}_update`,
          description: 'this is a description',
        },
        idToken,
        creds
      );

      await listDataVaultsSuccess(deaApiUrl, idToken, creds);

      // AuditEventType.GET_DATA_VAULT_FILES
      // db read vault
      // query
      await listDataVaultFilesSuccess(deaApiUrl, idToken, creds, deaDataVault.ulid);

      // AuditEventType.CREATE_CASE_ASSOCIATION
      // get vault
      // get file
      // get file (could probably reduce this)
      // TransactWriteItems casefile
      await createCaseAssociationSuccess(deaApiUrl, idToken, creds, deaDataVault.ulid, {
        caseUlids: [caseForAssociation.ulid],
        fileUlids: [dataVaultFile.ulid],
      });

      // wait for data plane events
      await delay(15 * MINUTES_TO_MILLISECONDS);

      const dataVaultEntries = await getAuditQueryResults(
        `${deaApiUrl}datavaults/${deaDataVault.ulid}/audit`,
        '',
        idToken,
        creds,
        [
          AuditEventType.CREATE_DATA_VAULT,
          AuditEventType.GET_DATA_VAULT_FILE_DETAIL,
          AuditEventType.UPDATE_DATA_VAULT_DETAILS,
          AuditEventType.GET_DATA_VAULT_FILES,
          AuditEventType.CREATE_CASE_ASSOCIATION,
        ],
        [
          { regex: /dynamodb.amazonaws.com/g, count: 12 },
          { regex: /TransactWriteItems/g, count: 4 },
          { regex: /GetItem/g, count: 7 },
          { regex: /Query/g, count: 1 },
        ]
      );

      const dataVaultFileEntries = await getAuditQueryResults(
        `${deaApiUrl}datavaults/${deaDataVault.ulid}/files/${dataVaultFile.ulid}/audit`,
        '',
        idToken,
        creds,
        [AuditEventType.GET_DATA_VAULT_FILE_DETAIL, AuditEventType.CREATE_CASE_ASSOCIATION],
        [
          { regex: /dynamodb.amazonaws.com/g, count: 5 },
          { regex: /TransactWriteItems/g, count: 2 },
          { regex: /GetItem/g, count: 3 },
        ]
      );

      const applicationEntriesDVF = dataVaultFileEntries.filter((entry) => entry.Event_Type !== 'AwsApiCall');
      const applicationEntriesDV = dataVaultEntries.filter((entry) => entry.Event_Type !== 'AwsApiCall');

      // // There should only be the following events for the audit:

      expect(applicationEntriesDVF).toHaveLength(2);
      expect(applicationEntriesDV).toHaveLength(5);

      // Now verify each of the event entries
      const createDatavault = applicationEntriesDV.find(
        (entry) => entry.Event_Type === AuditEventType.CREATE_DATA_VAULT
      );
      verifyAuditEntry(createDatavault, AuditEventType.CREATE_DATA_VAULT, testUser, testRole, {
        expectedResult: 'success',
        expectedFileHash: '',
        expectedCaseUlid: '',
        expectedFileUlid: '',
        expectedDataVaultId: deaDataVault.ulid,
      });

      const getFileDetailsDV = applicationEntriesDV.find(
        (entry) => entry.Event_Type === AuditEventType.GET_DATA_VAULT_FILE_DETAIL
      );
      verifyAuditEntry(getFileDetailsDV, AuditEventType.GET_DATA_VAULT_FILE_DETAIL, testUser, testRole, {
        expectedResult: 'success',
        expectedFileHash: '',
        expectedCaseUlid: '',
        expectedFileUlid: dataVaultFile.ulid,
        expectedDataVaultId: deaDataVault.ulid,
      });

      const getFileDetailsDVF = applicationEntriesDVF.find(
        (entry) => entry.Event_Type === AuditEventType.GET_DATA_VAULT_FILE_DETAIL
      );
      verifyAuditEntry(getFileDetailsDVF, AuditEventType.GET_DATA_VAULT_FILE_DETAIL, testUser, testRole, {
        expectedResult: 'success',
        expectedFileHash: '',
        expectedCaseUlid: '',
        expectedFileUlid: dataVaultFile.ulid,
        expectedDataVaultId: deaDataVault.ulid,
      });

      const updateDataVault = applicationEntriesDV.find(
        (entry) => entry.Event_Type === AuditEventType.UPDATE_DATA_VAULT_DETAILS
      );
      verifyAuditEntry(updateDataVault, AuditEventType.UPDATE_DATA_VAULT_DETAILS, testUser, testRole, {
        expectedResult: 'success',
        expectedFileHash: '',
        expectedCaseUlid: '',
        expectedFileUlid: '',
        expectedDataVaultId: deaDataVault.ulid,
      });

      const getDataVaultFiles = applicationEntriesDV.find(
        (entry) => entry.Event_Type === AuditEventType.GET_DATA_VAULT_FILES
      );
      verifyAuditEntry(getDataVaultFiles, AuditEventType.GET_DATA_VAULT_FILES, testUser, testRole, {
        expectedResult: 'success',
        expectedFileHash: '',
        expectedCaseUlid: '',
        expectedFileUlid: '',
        expectedDataVaultId: deaDataVault.ulid,
      });

      const createCaseAssociation = applicationEntriesDV.find(
        (entry) => entry.Event_Type === AuditEventType.CREATE_CASE_ASSOCIATION
      );
      verifyAuditEntry(createCaseAssociation, AuditEventType.CREATE_CASE_ASSOCIATION, testUser, testRole, {
        expectedResult: 'success',
        expectedFileHash: '',
        expectedCaseUlid: caseForAssociation.ulid,
        expectedFileUlid: dataVaultFile.ulid,
        expectedDataVaultId: deaDataVault.ulid,
      });
    },
    45 * MINUTES_TO_MILLISECONDS
  );
});
