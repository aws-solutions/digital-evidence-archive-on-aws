import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAvailableEndpoints } from '../../src/api/auth';
import { useGetDataVaultById } from '../../src/api/data-vaults';
import { breadcrumbLabels, commonLabels } from '../../src/common/labels';
import DataVaultDetailsPage from '../../src/pages/data-vault-detail';

let query: { dataVaultId: string | undefined } = { dataVaultId: '100' };
const push = jest.fn();
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query,
    push,
  })),
}));

jest.mock('../../src/api/auth', () => ({
  useAvailableEndpoints: jest.fn(),
}));

jest.mock('../../src/api/data-vaults', () => ({
  useGetDataVaultById: jest.fn(),
}));

describe('DataVaultDetailsPage', () => {
  beforeAll(() => {
    useAvailableEndpoints.mockImplementation(() => ({
      data: ['/datavaults/{dataVaultId}/detailsPUT'],
      isLoading: false,
    }));
  });
  it('renders a blank page with no dataVaultId', async () => {
    useGetDataVaultById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    const page = render(<DataVaultDetailsPage />);
    const anyHeader = screen.queryByRole('heading');

    expect(anyHeader).toBeTruthy();
    expect(page).toBeTruthy();

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(3);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.homePageLabel);
    expect(breadcrumbLinks[1].getElement()).toHaveTextContent(breadcrumbLabels.dataVaultsLabel);
    expect(breadcrumbLinks[2].getElement()).toHaveTextContent(breadcrumbLabels.dataVaultDetailsLabel);
  });

  it('renders a loading label during fetch', () => {
    useGetDataVaultById.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
    }));
    const page = render(<DataVaultDetailsPage />);
    const label = screen.getByText(commonLabels.loadingLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });

  it('renders a not found warning if no dataVaultId is provided', () => {
    query = { dataVaultId: undefined };
    useGetDataVaultById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    const page = render(<DataVaultDetailsPage />);
    const anyHeader = screen.queryByRole('heading');

    expect(anyHeader).toBeTruthy();
    expect(page).toBeTruthy();
  });

  it('renders the data vault detail page', async () => {
    query = { dataVaultId: '01HBF77SAC700F89WTQ7K6Q8QD' };
    useGetDataVaultById.mockImplementation(() => ({
      data: {
        ulid: '01HBF77SAC700F89WTQ7K6Q8QD',
        name: 'Some Data Vault',
        description: 'Some description',
        created: '2023-09-29T01:00:51.916Z',
      },
      isLoading: false,
    }));
    const page = render(<DataVaultDetailsPage />);
    const dataVaultName = await screen.findByText('Some Data Vault');
    expect(dataVaultName).toBeTruthy();
    expect(page).toBeTruthy();
  });

  it('navigates to edit data vault screen', async () => {
    query = { dataVaultId: '01HBF77SAC700F89WTQ7K6Q8QD' };
    useGetDataVaultById.mockImplementation(() => ({
      data: {
        ulid: '01HBF77SAC700F89WTQ7K6Q8QD',
        name: 'Some Data Vault',
        created: '2023-09-29T01:00:51.916Z',
      },
      isLoading: false,
    }));
    render(<DataVaultDetailsPage />);

    const editButton = await screen.findByText(commonLabels.editButton);
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    expect(push).toHaveBeenCalledWith('/edit-data-vault?dataVaultId=01HBF77SAC700F89WTQ7K6Q8QD');
  });
});
