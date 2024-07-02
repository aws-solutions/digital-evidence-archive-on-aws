/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import { Oauth2Token } from '../../models/auth';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  createDataVaultSuccess,
  describeDataVaultDetailsSuccess,
  updateDataVaultSuccess,
} from '../resources/support/datavault-support';
import { randomSuffix } from '../resources/test-helpers';
import { MdiTestHelper, verifyDataVault } from './mdi-test-helpers';

describe('verifies StartDataVaultTaskExecutions input checks', () => {
  const cognitoHelper = new CognitoHelper();
  const randSuffix = randomSuffix();

  const deaApiUrl = testEnv.apiUrlOutput;
  let creds: Credentials;
  let idToken: Oauth2Token;

  const mdiTestHelper = new MdiTestHelper(`DeaAPisMDITestUser`, randSuffix);

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(mdiTestHelper.testUser, 'WorkingManager', 'DeaMdiApis', 'MDITestUser');
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);
  }, 100000);

  afterAll(async () => {
    // Refresh creds because this is a long running test
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(mdiTestHelper.testUser);

    await mdiTestHelper.cleanup(creds, idToken);

    await cognitoHelper.cleanup();
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
      /*updated=*/ dataVault.updated,
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
  }, 100000);

  // TODO: When Delete Data Vault is Complete, write this test
  //    it('deletes a data vault', async() => {
  // 1. Create Data Vault
  // 2. Get Data Vault Details for Data Vault
  // 3. Create Case
  // 4. Create File Associations
  // 5. Delete Data Vault
  // 6. Try to get Data Vault Details, verify that it fails
  // 7. See files removed from case
  //    });
});
