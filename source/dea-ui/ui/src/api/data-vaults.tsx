/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaDataVault, DeaDataVaultInput } from '@aws/dea-app/lib/models/data-vault';
import useSWR from 'swr';
import { httpApiGet, httpApiPost, httpApiPut } from '../helpers/apiHelper';
import { DeaListResult, DeaSingleResult } from './models/api-results';

interface DataVaultListReponse {
  dataVaults: DeaDataVault[];
}

export const useListAllDataVaults = (): DeaListResult<DeaDataVault> => {
  const { data, error } = useSWR(() => `datavaults?limit=10000`, httpApiGet<DataVaultListReponse>);
  const dataVaults: DeaDataVault[] = data?.dataVaults ?? [];
  return { data: dataVaults, isLoading: !data && !error };
};

export const createDataVault = async (createDataVaultInput: DeaDataVaultInput): Promise<DeaDataVault> => {
  return httpApiPost(`datavaults`, { ...createDataVaultInput });
};

export const useGetDataVaultById = (id: string): DeaSingleResult<DeaDataVault | undefined> => {
  const { data, error } = useSWR(() => `datavaults/${id}/details`, httpApiGet<DeaDataVault>);
  return { data, isLoading: !data && !error };
};

export const updateDataVault = async (updateDataVault: DeaDataVault): Promise<DeaDataVault> => {
  const {ulid, name, description} = updateDataVault;
  return httpApiPut(`datavaults/${updateDataVault.ulid}/details`, { ulid, name, description });
};