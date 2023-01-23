import { Header } from '@cloudscape-design/components';

export const TableHeader = (props: any) => {
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

function getCounter(props: any) {
  if (props.counter) {
    return props.counter;
  }
  if (!props.totalItems) {
    return null;
  }
  return getHeaderCounterText(props.totalItems, props.selectedItems);
}

export const getHeaderCounterText = (items = [], selectedItems = []) => {
  return selectedItems && selectedItems.length > 0
    ? `(${selectedItems.length}/${items.length})`
    : `(${items.length})`;
};
