import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { commonLabels } from '../../src/common/labels';
import Breadcrumb, { BreadcrumbItem } from '../../src/components/common-components/Breadcrumb';
import { Icon, IconProps } from '@cloudscape-design/components';
import createWrapper from '@cloudscape-design/components/test-utils/dom';

let breadcrumbItems: BreadcrumbItem[] = [
  { label: 'Case Files', value: '#', iconName: 'icon' as IconProps.Name },
];

describe('Breadcrumb', () => {
  it('renders a breadcrumb and icon', async () => {
    const component = render(
      <Breadcrumb
        filesTableState={{}}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={() => {}}
      />
    );
    expect(component).toBeTruthy();
  });

  it('renders a breadcrumb with 2 items', async () => {
    breadcrumbItems.push({ label: 'f1', value: 'f1', iconName: 'icon' as IconProps.Name });

    const component = render(
      <Breadcrumb
        filesTableState={{}}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={() => {}}
      />
    );
    expect(component).toBeTruthy();
  });

  it('renders a breadcrumb with 3 items', async () => {
    breadcrumbItems.push({ label: 'f1', value: 'f1', iconName: 'icon' as IconProps.Name });
    breadcrumbItems.push({ label: 'f2', value: 'f2', iconName: 'icon' as IconProps.Name });

    const component = render(
      <Breadcrumb
        filesTableState={{}}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={() => {}}
      />
    );
    expect(component).toBeTruthy();
  });

  it('renders a breadcrumb with 4 items', async () => {
    breadcrumbItems.push({ label: 'f1', value: 'f1', iconName: 'icon' as IconProps.Name });
    breadcrumbItems.push({ label: 'f2', value: 'f2', iconName: 'icon' as IconProps.Name });
    breadcrumbItems.push({ label: 'f3', value: 'f3', iconName: 'icon' as IconProps.Name });

    const component = render(
      <Breadcrumb
        filesTableState={{}}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={() => {}}
      />
    );
    expect(component).toBeTruthy();
  });

  it('renders a breadcrumb with 4+ items', async () => {
    breadcrumbItems.push({ label: 'f1', value: 'f1', iconName: 'icon' as IconProps.Name });
    breadcrumbItems.push({ label: 'f2', value: 'f2', iconName: 'icon' as IconProps.Name });
    breadcrumbItems.push({ label: 'f3', value: 'f3', iconName: 'icon' as IconProps.Name });
    breadcrumbItems.push({ label: 'f4', value: 'f4', iconName: 'icon' as IconProps.Name });

    const component = render(
      <Breadcrumb
        filesTableState={{}}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={() => {}}
      />
    );
    expect(component).toBeTruthy();
  });
});
