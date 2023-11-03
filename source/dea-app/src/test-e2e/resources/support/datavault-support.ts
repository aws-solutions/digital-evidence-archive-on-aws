/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { Oauth2Token } from '../../../models/auth';
import { CaseAssociationDTO } from '../../../models/case-file';
import { DeaDataVault, DeaDataVaultInput, DeaDataVaultUpdateInput } from '../../../models/data-vault';
import { DeaDataVaultFile } from '../../../models/data-vault-file';
import { dataVaultResponseSchema } from '../../../models/validation/data-vault';
import { callDeaAPIWithCreds } from '../test-helpers';

export async function createDataVaultSuccess(
  baseUrl: string,
  deaDataVault: DeaDataVaultInput,
  idToken: Oauth2Token,
  creds: Credentials
): Promise<DeaDataVault> {
  const response = await callDeaAPIWithCreds(`${baseUrl}datavaults`, 'POST', idToken, creds, deaDataVault);

  if (response.status !== 200) {
    console.log(response.data);
  }
  expect(response.status).toEqual(200);

  const createdVault: DeaDataVault = response.data;
  Joi.assert(createdVault, dataVaultResponseSchema);
  expect(createdVault.name).toEqual(deaDataVault.name);
  return createdVault;
}

export async function updateDataVaultSuccess(
  baseUrl: string,
  dataVaultId: string,
  deaDataVault: DeaDataVaultUpdateInput,
  idToken: Oauth2Token,
  creds: Credentials
): Promise<DeaDataVault> {
  const response = await callDeaAPIWithCreds(
    `${baseUrl}datavaults/${dataVaultId}/details`,
    'PUT',
    idToken,
    creds,
    deaDataVault
  );

  if (response.status !== 200) {
    console.log(response.data);
  }
  expect(response.status).toEqual(200);

  const updatedVault: DeaDataVault = response.data;
  Joi.assert(updatedVault, dataVaultResponseSchema);
  expect(updatedVault.name).toEqual(deaDataVault.name);
  return updatedVault;
}

type DataVaultsResponse = {
  dataVaults: DeaDataVault[];
  total: number;
  next: string;
};

export async function listDataVaultsSuccess(
  baseUrl: string,
  idToken: Oauth2Token,
  creds: Credentials
): Promise<DataVaultsResponse> {
  const response = await callDeaAPIWithCreds(`${baseUrl}datavaults`, 'GET', idToken, creds);

  if (response.status !== 200) {
    console.log(response.data);
  }
  expect(response.status).toEqual(200);

  const vaults: DataVaultsResponse = response.data;
  return vaults;
}

export const describeDataVaultDetailsSuccess = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string
): Promise<DeaDataVault> => {
  const response = await callDeaAPIWithCreds(
    `${deaApiUrl}datavaults/${dataVaultId}/details`,
    'GET',
    idToken,
    creds
  );

  expect(response.status).toEqual(200);
  return response.data;
};

export const lisDataVaultFilesSuccess = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string
): Promise<DeaDataVaultFile> => {
  const response = await callDeaAPIWithCreds(
    `${deaApiUrl}datavaults/${dataVaultId}/files`,
    'GET',
    idToken,
    creds
  );

  expect(response.status).toEqual(200);
  return response.data;
};

export const describeDataVaultFileDetailsSuccess = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string,
  fileUlid: string
): Promise<DeaDataVaultFile> => {
  const response = await callDeaAPIWithCreds(
    `${deaApiUrl}datavaults/${dataVaultId}/files/${fileUlid}/info`,
    'GET',
    idToken,
    creds
  );

  expect(response.status).toEqual(200);
  return response.data;
};

export const createCaseAssociationSuccess = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  dataVaultId: string,
  associationDTO: CaseAssociationDTO
): Promise<DeaDataVaultFile> => {
  const response = await callDeaAPIWithCreds(
    `${deaApiUrl}datavaults/${dataVaultId}/caseAssociations`,
    'POST',
    idToken,
    creds,
    associationDTO
  );

  expect(response.status).toEqual(200);
  return response.data;
};
