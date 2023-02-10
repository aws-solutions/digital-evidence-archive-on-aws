/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { PropertyFilterProperty } from '@cloudscape-design/collection-hooks';
import { PropertyFilterProps } from '@cloudscape-design/components';

export const filteringProperties: readonly PropertyFilterProperty[] = [
  {
    key: 'name',
    operators: ['=', '!=', ':', '!:'],
    propertyLabel: 'Case Name',
    groupValuesLabel: 'Case Name Values',
  },
  {
    key: 'caseLead',
    operators: ['=', '!=', ':', '!:'],
    propertyLabel: 'Case Lead',
    groupValuesLabel: 'Case Lead Values',
  },
  {
    key: 'created',
    operators: ['<', '<=', '>', '>=', ':'],
    propertyLabel: 'Creation Date',
    groupValuesLabel: 'Creation Date Values',
  },
];

export const searchableColumns: string[] = ['name', 'caseLead', 'creationDate'];

export const filteringOptions: readonly PropertyFilterProps.FilteringOption[] = [
  { propertyKey: 'caseLead', value: '' },
  { propertyKey: 'name', value: '' },
  { propertyKey: 'creationDate', value: '' },
];
