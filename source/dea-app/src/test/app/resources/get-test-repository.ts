/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { initLocalDb } from '../../persistence/local-db-table';

export const getTestRepositoryProvider = async (tableName: string): Promise<ModelRepositoryProvider> => {
  const table = await initLocalDb(tableName);
  return {
    table: table,
    CaseModel: table.getModel('Case'),
    CaseUserModel: table.getModel('CaseUser'),
    CaseFileModel: table.getModel('CaseFile'),
    UserModel: table.getModel('User'),
  };
};
