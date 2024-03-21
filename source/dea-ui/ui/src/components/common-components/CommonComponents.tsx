/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box } from '@cloudscape-design/components';
import { commonLabels } from '../../common/labels';

/**
 * Displays the empty state of any table
 * @param itemType - type of item that the table displays
 * @example
 * ```
 * <Table empty={ TableEmptyDisplay("workspace") } />
 * // Displays "No workspaces" title
 * // "No workspaces to display."
 * // <Button> with "Create workspace" text
 * ```
 * @returns empty table information and call to action
 */
export function TableEmptyDisplay(
  noItemType: string,
  noItemTypeDisplay: string,
  action?: React.ReactNode
): JSX.Element {
  return (
    <Box textAlign="center" color="inherit">
      <b>{noItemType}</b>
      <Box padding={{ bottom: 's' }} variant="p" color="inherit">
        {noItemTypeDisplay}
      </Box>
      {action}
    </Box>
  );
}
/**
 * Displays the no match state of any table
 * @param itemType - type of item that the table displays
 * @example
 * ```
 * {propertyFiltering: {noMatch: (TableNoMatchDisplay("workspace"))}
 * // Displays "No matches" title
 * // "No workspaces match filter."
 * ```
 * @returns no match information
 */
export function TableNoMatchDisplay(noItemTypeMatch: string): JSX.Element {
  return (
    <Box textAlign="center" color="inherit">
      <b>{commonLabels.noMatchesLabel}</b>
      <Box padding={{ bottom: 's' }} variant="p" color="inherit">
        {noItemTypeMatch}
      </Box>
    </Box>
  );
}
