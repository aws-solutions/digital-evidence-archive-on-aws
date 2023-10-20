import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAvailableEndpoints } from '../../src/api/auth';
import { useGetDataVaultById, useListDataVaultFiles } from '../../src/api/data-vaults';
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
  useListDataVaultFiles: jest.fn(),
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
    expect(breadcrumbLinks.length).toEqual(2);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.dataVaultsLabel);
    expect(breadcrumbLinks[1].getElement()).toHaveTextContent(breadcrumbLabels.dataVaultDetailsLabel);
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
    useListDataVaultFiles.mockImplementation(() => ({
      data: [
        {
          ulid: '01HD2SGVA662N6TMREH510BWZW',
          fileName: 'joi-17.9.1',
          filePath: '/',
          dataVaultUlid: '01HD2S8KR23WJNNFGSBZEEGGA5',
          isFile: false,
          fileSizeBytes: 0,
          createdBy: 'John Doe',
          contentType: 'Directory',
          fileS3Key: 'DATAVAULT01HD2S8KR23WJNNFGSBZEEGGA5/destination/joi-17.9.1',
          executionId: 'exec-07a3f261f2f985d5f',
          updated: new Date('2023-10-19T01:41:39.270Z'),
        },
        {
          ulid: '01HD2SGVHV8DEAZQP5ZEEZ6F81',
          fileName: 'README.md',
          filePath: '/joi-17.9.1/',
          dataVaultUlid: '01HD2S8KR23WJNNFGSBZEEGGA5',
          isFile: true,
          fileSizeBytes: 458,
          createdBy: 'John Doe',
          contentType: 'md',
          sha256Hash: 'SHA256:52773d75ca79b81253ad1409880ab061d66f0e5bbcc1e820b008e7617c78d745',
          versionId: 'ss6KHy3J4ErNEGgFn0kTEq5caL11bYqU',
          fileS3Key: 'DATAVAULT01HD2S8KR23WJNNFGSBZEEGGA5/destination/joi-17.9.1/README.md',
          executionId: 'exec-07a3f261f2f985d5f',
          updated: new Date('2023-10-19T01:41:39.515Z'),
        },
      ],
      isLoading: false,
    }));
    const page = render(<DataVaultDetailsPage />);
    const dataVaultName = await screen.findByText('Some Data Vault');
    expect(dataVaultName).toBeTruthy();

    const folderEntry = await screen.findByText('joi-17.9.1');
    expect(folderEntry).toBeTruthy();

    fireEvent.click(folderEntry);
    const fileEntry = await screen.findByText('README.md');
    expect(fileEntry).toBeTruthy();

    // click the breadcrumb to return to the root
    const rootLink = await screen.findByText('/');
    fireEvent.click(rootLink);

    const table = await screen.findByTestId('file-table');
    const tableWrapper = wrapper(table);
    const textFilter = tableWrapper.findTextFilter();
    if (!textFilter) {
      fail();
    }
    const textFilterInput = textFilter.findInput();
    textFilterInput.setInputValue('README.md');

    // after filtering, folder entry will not be visible
    await waitFor(() => expect(screen.queryByTestId('joi-17.9.1-file-button')).toBeNull());

    // clear the filter
    textFilterInput.setInputValue('');
    await waitFor(() => expect(screen.queryByTestId('joi-17.9.1-file-button')).toBeDefined());

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
    useListDataVaultFiles.mockImplementation(() => ({
      data: [],
      isLoading: true,
    }));
    render(<DataVaultDetailsPage />);

    const editButton = await screen.findByText(commonLabels.editButton);
    await waitFor(() => expect(editButton).toBeEnabled());
    fireEvent.click(editButton);
    expect(push).toHaveBeenCalledWith('/edit-data-vault?dataVaultId=01HBF77SAC700F89WTQ7K6Q8QD');
  });

  it('navigates to data vault file details page', async () => {
    query = { dataVaultId: '01HBF77SAC700F89WTQ7K6Q8QD' };
    const mockedFile = {
      ulid: '01HD2SGVHV8DEAZQP5ZEEZ6F81',
      fileName: 'README.md',
      filePath: '/joi-17.9.1/',
      dataVaultUlid: '01HD2S8KR23WJNNFGSBZEEGGA5',
      isFile: true,
      fileSizeBytes: 458,
      createdBy: 'John Doe',
      contentType: 'md',
      sha256Hash: 'SHA256:52773d75ca79b81253ad1409880ab061d66f0e5bbcc1e820b008e7617c78d745',
      versionId: 'ss6KHy3J4ErNEGgFn0kTEq5caL11bYqU',
      fileS3Key: 'DATAVAULT01HD2S8KR23WJNNFGSBZEEGGA5/destination/joi-17.9.1/README.md',
      executionId: 'exec-07a3f261f2f985d5f',
      updated: new Date('2023-10-19T01:41:39.515Z'),
    };
    useGetDataVaultById.mockImplementation(() => ({
      data: {
        ulid: '01HBF77SAC700F89WTQ7K6Q8QD',
        name: 'Some Data Vault',
        description: 'Some description',
        created: '2023-09-29T01:00:51.916Z',
      },
      isLoading: false,
    }));
    useListDataVaultFiles.mockImplementation(() => ({
      data: [mockedFile],
      isLoading: false,
    }));
    const page = render(<DataVaultDetailsPage />);
    expect(page).toBeTruthy();

    const fileEntry = await screen.findByText(mockedFile.fileName);
    fireEvent.click(fileEntry);

    expect(push).toHaveBeenCalledWith(
      `/data-vault-file-detail?dataVaultId=${mockedFile.dataVaultUlid}&fileId=${mockedFile.ulid}`
    );
  });
});
