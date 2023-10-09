/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Header, HeaderProps } from '@cloudscape-design/components';
import { ReactElement } from 'react';

interface TableHeaderProps {
  readonly variant: HeaderProps.Variant | undefined;
  readonly description: React.ReactNode;
  readonly actionButtons: ReactElement;
  readonly title: string;
  readonly counter?: string;
  readonly totalItems?: ReadonlyArray<unknown>;
  readonly selectedItems?: ReadonlyArray<unknown>;
}

export const TableHeader = (props: TableHeaderProps) => {
  return (
    <Header
      variant={props.variant}
      counter={getCounter(props)}
      description={props.description}
      actions={props.actionButtons}
    >
      {props.title}
    </Header>
  );
};

function getCounter(props: TableHeaderProps): string | undefined {
  if (props.counter) {
    return props.counter;
  }
  if (!props.totalItems) {
    return undefined;
  }
  return getHeaderCounterText(props.totalItems, props.selectedItems);
}

export const getHeaderCounterText = (items: readonly unknown[], selectedItems: readonly unknown[] = []) => {
  if (selectedItems && selectedItems.length > 0) {
    return `(${selectedItems.length}/${items.length})`;
  }

  return `(${items.length})`;
};
