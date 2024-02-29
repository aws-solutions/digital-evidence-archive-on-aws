import '@testing-library/jest-dom';
import {
  findAllByText,
  fireEvent,
  getAllByLabelText,
  getByAltText,
  getByLabelText,
  getByText,
  render,
  screen,
} from '@testing-library/react';
import { breadcrumbLabels, commonLabels } from '../../src/common/labels';
import Breadcrumb, { BreadcrumbItem } from '../../src/components/common-components/Breadcrumb';
import { Icon, IconProps } from '@cloudscape-design/components';

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
        onClick={jest.fn()}
      />
    );

    expect(component).toBeTruthy();
    // get root label (non clickable)
    expect(screen.getByText(breadcrumbItems[0].label));
    // get icon
    expect(screen.getByLabelText(breadcrumbLabels.breadcrumbIconLabel));
    // no '>' icon
    expect(screen.queryByLabelText(breadcrumbLabels.nextLevelIconLabel)).toBeFalsy();
  });

  it('renders a breadcrumb with 2 items', async () => {
    breadcrumbItems.push({ label: 'f1', value: 'f1', iconName: 'icon' as IconProps.Name });

    const component = render(
      <Breadcrumb
        filesTableState={{}}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={jest.fn()}
      />
    );

    expect(component).toBeTruthy();
    // get root label (clickable)
    expect(screen.getByLabelText(breadcrumbLabels.rootDescriptiveLabel));
    // get first item
    expect(screen.getByText(breadcrumbItems[1].label));
    // one '>' icon
    expect(screen.queryAllByLabelText(breadcrumbLabels.nextLevelIconLabel)).toHaveLength(1);
  });

  it('renders a breadcrumb with 3 items', async () => {
    breadcrumbItems.push({ label: 'f2', value: 'f2', iconName: 'icon' as IconProps.Name });

    const component = render(
      <Breadcrumb
        filesTableState={{}}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={jest.fn()}
      />
    );

    expect(component).toBeTruthy();
    expect(screen.getByLabelText(breadcrumbLabels.rootDescriptiveLabel));
    expect(screen.getByText(breadcrumbItems[2].label));
    // 2 '>' icons
    expect(screen.queryAllByLabelText(breadcrumbLabels.nextLevelIconLabel)).toHaveLength(2);
    // no dropdown
    expect(screen.queryByLabelText(breadcrumbLabels.selectFileLevelDropdownLabel)).toBeFalsy();
  });

  it('renders a breadcrumb with 4 items', async () => {
    breadcrumbItems.push({ label: 'f3', value: 'f3', iconName: 'icon' as IconProps.Name });

    const component = render(
      <Breadcrumb
        filesTableState={{ textFilter: '', basePath: '/f1/f2/f3', label: 'f3' }}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={jest.fn()}
      />
    );
    expect(component).toBeTruthy();
    expect(screen.getByLabelText(breadcrumbLabels.rootDescriptiveLabel));
    // one '>' icon
    expect(screen.queryAllByLabelText(breadcrumbLabels.nextLevelIconLabel)).toHaveLength(1);
    // find label in dropdown box
    expect(screen.getByText(breadcrumbItems[3].label));
    // have dropdown
    expect(screen.queryAllByLabelText(breadcrumbLabels.selectFileLevelDropdownLabel));
  });

  it('renders a breadcrumb with 4+ items', async () => {
    breadcrumbItems.push({ label: 'f4', value: 'f4', iconName: 'icon' as IconProps.Name });

    const component = render(
      <Breadcrumb
        filesTableState={{ textFilter: '', basePath: '/f1/f2/f3/f4', label: 'f4' }}
        breadcrumbItems={breadcrumbItems}
        data-testid="files-breadcrumb"
        onClick={jest.fn()}
      />
    );
    expect(component).toBeTruthy();
    expect(screen.getByLabelText(breadcrumbLabels.rootDescriptiveLabel));
    // one '>' icon
    expect(screen.queryAllByLabelText(breadcrumbLabels.nextLevelIconLabel)).toHaveLength(1);
    // find label in dropdown box
    expect(screen.getByText(breadcrumbItems[4].label));
    // can't find previous label in dropdown box
    expect(screen.queryByText(breadcrumbItems[3].label)).toBeFalsy();
    // have dropdown
    expect(screen.queryAllByLabelText(breadcrumbLabels.selectFileLevelDropdownLabel));
  });
});
