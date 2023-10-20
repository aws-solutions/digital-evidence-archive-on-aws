import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useGetDataVaultFileDetailsById } from '../../src/api/data-vaults';
import { commonLabels } from '../../src/common/labels';
import DataVaultFileDetailPage from '../../src/pages/data-vault-file-detail';

let query: { dataVaultId: any; fileId: any } = { dataVaultId: '100', fileId: '200' };
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query,
    push: jest.fn(),
  })),
}));

jest.mock('../../src/api/data-vaults', () => ({
  useGetDataVaultFileDetailsById: jest.fn(),
}));

const dataVaultFile = {
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

describe('CaseDetailsPage', () => {
  it('renders a data vault file details page', async () => {
    useGetDataVaultFileDetailsById.mockImplementation(() => ({
      data: dataVaultFile,
      isLoading: false,
    }));
    const page = render(<DataVaultFileDetailPage />);
    expect(page).toBeTruthy();

    const mockedCaseInfo = await screen.findByText(dataVaultFile.fileName);
    expect(mockedCaseInfo).toBeTruthy();
  });

  it('renders a blank page with no dataVaultId', async () => {
    useGetDataVaultFileDetailsById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    render(<DataVaultFileDetailPage />);
    await screen.findByText(commonLabels.notFoundLabel);
  });

  it('renders a loading label during fetch', () => {
    useGetDataVaultFileDetailsById.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
    }));
    render(<DataVaultFileDetailPage />);
    screen.findByText(commonLabels.loadingLabel);
  });

  it('renders a not found warning if no dataVaultId is provided', () => {
    query = { dataVaultId: undefined, fileId: '200' };
    const page = render(<DataVaultFileDetailPage />);
    render(<DataVaultFileDetailPage />);
    screen.findByText(commonLabels.notFoundLabel);
  });

  it('renders a not found warning if no fileId is provided', () => {
    query = { dataVaultId: '100', fileId: undefined };
    render(<DataVaultFileDetailPage />);
    screen.findByText(commonLabels.notFoundLabel);
  });

  it('renders a not found warning if dataVaultId is not a string', () => {
    query = { dataVaultId: {}, fileId: '200' };
    render(<DataVaultFileDetailPage />);
    screen.findByText(commonLabels.notFoundLabel);
  });

  it('renders a not found warning if fileId is not a string', () => {
    query = { dataVaultId: '100', fileId: {} };
    render(<DataVaultFileDetailPage />);
    screen.findByText(commonLabels.notFoundLabel);
  });
});
