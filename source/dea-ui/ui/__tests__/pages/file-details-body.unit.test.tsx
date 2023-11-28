import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { CaseFileDTO } from '@aws/dea-app/lib/models/case-file';
import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useGetCaseActions, useGetFileDetailsById } from '../../src/api/cases';
import FileDetailsBody from '../../src/components/file-details/FileDetailsBody';
import { commonLabels } from '../../src/common/labels';

let query: { caseId: any; fileId: any } = { caseId: '100', fileId: '200' };
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query,
    push: jest.fn(),
  })),
}));

jest.mock('../../src/api/cases', () => ({
  useGetFileDetailsById: jest.fn(),
  useGetCaseActions: jest.fn(),
}));

const mockedFileInfo: CaseFileDTO = {
  ulid: '200',
  caseUlid: '100',
  fileName: 'afile.png',
  contentType: 'image/png',
  createdBy: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  filePath: '/food/',
  fileSizeBytes: 1234,
  sha256Hash: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  status: 'ACTIVE',
  created: new Date(),
  updated: new Date(),
  isFile: true,
  reason: 'reason',
  details: 'details',
  fileS3Key: 'test/test',
};

const mockedFileInfoFromDV: CaseFileDTO = {
  ulid: '200',
  caseUlid: '100',
  fileName: 'afile.png',
  contentType: 'image/png',
  createdBy: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  filePath: '/food/',
  fileSizeBytes: 1234,
  sha256Hash: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  status: 'ACTIVE',
  created: new Date(),
  updated: new Date(),
  isFile: true,
  reason: 'reason',
  details: 'details',
  fileS3Key: 'test/test',
  dataVaultUlid: 'DUMMYDATAVAULTULID',
  dataVaultName: 'dataVaultName',
};

describe('FileDetailsBody', () => {
  it('renders a data vault details section', async () => {
    useGetFileDetailsById.mockImplementation(() => ({
      data: mockedFileInfo,
      isLoading: false,
    }));
    useGetCaseActions.mockImplementation(() => ({
      data: {
        actions: CaseAction.VIEW_CASE_DETAILS,
      },
      isLoading: false,
    }));

    const props = {
      caseId: '123',
      fileId: 'abc',
    };

    render(<FileDetailsBody {...props} />);

    await screen.findByText(mockedFileInfo.fileName);
  });
  it('renders file body with data vault details', async () => {
    useGetFileDetailsById.mockImplementation(() => ({
      data: mockedFileInfoFromDV,
      isLoading: false,
    }));
    useGetCaseActions.mockImplementation(() => ({
      data: {
        actions: CaseAction.VIEW_CASE_DETAILS,
      },
      isLoading: false,
    }));
    const props = {
      caseId: '123',
      fileId: 'abc',
    };

    render(<FileDetailsBody {...props} />);

    await screen.findByText(mockedFileInfo.fileName);
    await screen.findByText(mockedFileInfoFromDV.dataVaultName ? mockedFileInfoFromDV.dataVaultName : '-');
  });
  it('renders a loading label during fetch', async () => {
    useGetFileDetailsById.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
    }));
    const props = {
      caseId: '123',
      fileId: 'abc',
    };

    render(<FileDetailsBody {...props} />);
    await screen.findByText(commonLabels.loadingLabel);
  });
  it('renders a blank page with no data vault data', async () => {
    useGetFileDetailsById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    const props = {
      caseId: '123',
      fileId: 'abc',
    };

    render(<FileDetailsBody {...props} />);
    await screen.findByText(commonLabels.notFoundLabel);
  });
});
