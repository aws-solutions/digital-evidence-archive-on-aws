/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { PropertyFilterProps } from '@cloudscape-design/components';
import { FlashbarProps } from '@cloudscape-design/components';

export const i18nStringsForFlashbar: FlashbarProps.I18nStrings = {
  ariaLabel: 'Notifications bar',
  errorIconAriaLabel: 'Error',
  infoIconAriaLabel: 'Info',
  successIconAriaLabel: 'Success',
  warningIconAriaLabel: 'Warning',
};

export const i18nStringsForPropertyFilter: PropertyFilterProps.I18nStrings = {
  filteringAriaLabel: 'Search',
  dismissAriaLabel: 'Dismiss',
  filteringPlaceholder: 'Search',
  groupValuesText: 'Values',
  groupPropertiesText: 'Properties',
  operatorsText: 'Operators',
  operationAndText: 'and',
  operationOrText: 'or',
  operatorLessText: 'Less than',
  operatorLessOrEqualText: 'Less than or equal',
  operatorGreaterText: 'Greater than',
  operatorGreaterOrEqualText: 'Greater than or equal',
  operatorContainsText: 'Contains',
  operatorDoesNotContainText: 'Does not contain',
  operatorEqualsText: 'Equals',
  operatorDoesNotEqualText: 'Does not equal',
  tokenOperatorAriaLabel: 'Boolean operator',
  editTokenHeader: 'Edit filter',
  propertyText: 'Property',
  operatorText: 'Operator',
  valueText: 'Value',
  cancelActionText: 'Cancel',
  applyActionText: 'Apply',
  allPropertiesLabel: 'All properties',
  tokenLimitShowMore: 'Show more',
  tokenLimitShowFewer: 'Show fewer',
  clearFiltersText: 'Clear filters',
  clearAriaLabel: 'Clear field',
  removeTokenButtonAriaLabel: (token: PropertyFilterProps.Token) => `Remove token ${token.propertyKey}`,
  enteredTextLabel: (text: string) => `Use: "${text}"`,
};
