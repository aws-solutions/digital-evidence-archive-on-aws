/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { PropertyFilterProperty } from '@cloudscape-design/collection-hooks';
import { PropertyFilterProps } from '@cloudscape-design/components';

export const filteringProperties: readonly PropertyFilterProperty[] = [
  {
    key: 'taskId',
    operators: ['=', '!=', ':', '!:'],
    propertyLabel: 'Task ID',
    groupValuesLabel: 'Task ID Values',
  },
  {
    key: 'dataVaultName',
    operators: ['=', '!=', ':', '!:'],
    propertyLabel: 'Data Vault Name',
    groupValuesLabel: 'Data Vault Name Values',
  },
  {
    key: 'created',
    operators: ['<', '<=', '>', '>=', ':'],
    propertyLabel: 'Creation Date',
    groupValuesLabel: 'Creation Date Values',
  },
];

export const searchableColumns: string[] = ['taskId', 'dataVaultName', 'created'];

export const filteringOptions: readonly PropertyFilterProps.FilteringOption[] = [
  { propertyKey: 'taskId', value: '' },
  { propertyKey: 'dataVaultName', value: '' },
  { propertyKey: 'created', value: '' },
];
