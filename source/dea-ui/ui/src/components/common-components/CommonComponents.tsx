import { Box } from '@cloudscape-design/components';

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
export function TableEmptyDisplay(itemType: string): JSX.Element {
  return (
    <Box textAlign="center" color="inherit">
      <b>No {itemType}s</b>
      <Box padding={{ bottom: 's' }} variant="p" color="inherit">
        No {itemType}s to display.
      </Box>
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
export function TableNoMatchDisplay(itemType: string): JSX.Element {
  return (
    <Box textAlign="center" color="inherit">
      <b>No matches</b>
      <Box padding={{ bottom: 's' }} variant="p" color="inherit">
        No {itemType}s match filter.
      </Box>
    </Box>
  );
}
