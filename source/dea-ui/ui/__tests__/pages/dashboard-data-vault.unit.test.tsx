import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fail } from 'assert';
import axios from 'axios';
import { breadcrumbLabels, dataVaultListLabels } from '../../src/common/labels';
import DataVaultsPage from '../../src/pages/data-vaults';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const push = jest.fn();

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  })),
}));

describe('DataVault Dashboard', () => {
  beforeAll(() => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith('availableEndpoints')) {
        return Promise.resolve({
          data: {
            endpoints: ['/datavaultsPOST'],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: {
            dataVaults: [
              {
                ulid: '01HBF77SAC700F89WTQ7K6Q8QD',
                name: 'Some Data Vault',
                description: 'Some description',
                created: '2023-09-29T01:00:51.916Z',
              },
              {
                ulid: '01HBH2V9SHZQ9NVMSD0Q47ZJEJ',
                name: 'Another Data Vault',
                description: 'Another Description',
                created: '2023-09-29T18:22:37.361Z',
              },
            ],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });
  });

  it('renders a list of data vaults', async () => {
    const page = render(<DataVaultsPage />);
    const listItem = await screen.findByText('Some Data Vault');

    expect(page).toBeTruthy();
    expect(listItem).toBeTruthy();

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(2);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.homePageLabel);
    expect(breadcrumbLinks[1].getElement()).toHaveTextContent(breadcrumbLabels.dataVaultsLabel);
  });

  it('navigates to create a new data vault', async () => {
    render(<DataVaultsPage />);

    const createButton = await screen.findByText(dataVaultListLabels.createNewDataVaultLabel);
    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.click(createButton);
    expect(push).toHaveBeenCalledWith('/create-data-vaults');
  });

  it('navigates to data vault details', async () => {
    render(<DataVaultsPage />);

    const table = await screen.findByTestId('data-vaults-table');
    const link = wrapper(table).findLink();

    if (!link) {
      fail();
    }
    link.click();

    expect(push).toHaveBeenCalledWith('/data-vault-detail?dataVaultId=01HBF77SAC700F89WTQ7K6Q8QD');
  });
});
