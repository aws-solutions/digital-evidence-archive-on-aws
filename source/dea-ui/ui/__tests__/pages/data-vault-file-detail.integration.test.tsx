import { QueryExecutionState } from '@aws-sdk/client-athena';
import { DeaDataVaultFile } from '@aws/dea-app/lib/models/data-vault-file';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Axios from 'axios';
import { AuditResult } from '../../src/api/cases';
import { auditLogLabels } from '../../src/common/labels';
import {
  DATA_VAULTS_FILE_AUDIT_ENDPOINT,
  DOWNLOAD_VAULT_FILE_AUDIT_TEST_ID,
} from '../../src/components/data-vault-file-details/DataVaultFileDetailsBody';
import DataVaultFileDetailPage from '../../src/pages/data-vault-file-detail';

afterEach(cleanup);

const push = jest.fn();
const DATAVAULT_ID = '100';
const FILE_ID = '200';
const DATA_VAULT_NAME = 'mocked data vault';
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { dataVaultId: DATAVAULT_ID, fileId: FILE_ID, dataVaultName: DATA_VAULT_NAME },
    push,
  })),
}));

global.fetch = jest.fn(() => Promise.resolve({ blob: () => Promise.resolve('foo') }));
global.window.URL.createObjectURL = jest.fn(() => {});
HTMLAnchorElement.prototype.click = jest.fn();

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const mockedFileInfo: DeaDataVaultFile = {
  ulid: 'FILE_ULID',
  dataVaultUlid: 'DATAVAULT_ULID',
  filePath: 'FILE_PATH',
  fileName: 'FILE_NAME',
  isFile: true,
  fileS3Key: 'FILE_S3_KEY',
  fileSizeBytes: 1,
  createdBy: 'CREATED_BY',
  executionId: 'EXECUTION_ID',
  caseCount: 1,
};

let csvCall = -1;
const csvResult: AuditResult[] = [
  { status: QueryExecutionState.RUNNING, downloadUrl: undefined },
  { status: QueryExecutionState.RUNNING, downloadUrl: undefined },
  { status: QueryExecutionState.SUCCEEDED, downloadUrl: 'url' },
];

mockedAxios.create.mockReturnThis();
mockedAxios.request.mockImplementation((eventObj) => {
  if (eventObj.url?.endsWith(`${DATAVAULT_ID}/files/${FILE_ID}/info`)) {
    return Promise.resolve({
      data: mockedFileInfo,
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else if (eventObj.url?.endsWith('audit')) {
    return Promise.resolve({
      data: { auditId: '11111111-1111-1111-1111-111111111111' },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else if (eventObj.url?.endsWith('availableEndpoints')) {
    return Promise.resolve({
      data: {
        endpoints: [DATA_VAULTS_FILE_AUDIT_ENDPOINT],
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } /* /csv */ else {
    return Promise.resolve({
      data: csvResult[++csvCall],
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  }
});

describe('DatavaultFileDetailPage', () => {
  it('renders a file details page', async () => {
    const page = render(<DataVaultFileDetailPage />);
    expect(page).toBeTruthy();

    const mockedFileText = await screen.findAllByText(mockedFileInfo.fileName);
    expect(mockedFileText.length).toEqual(2); // Header and breadcrumb
    expect(mockedFileText).toBeTruthy();
  });

  it('downloads a file audit', async () => {
    const page = render(<DataVaultFileDetailPage />);
    expect(page).toBeTruthy();

    const downloadCsvButton = await screen.findByText(auditLogLabels.downloadFileAuditLabel);
    fireEvent.click(downloadCsvButton);

    // upload button will be disabled while in progress and then re-enabled when done
    await waitFor(() => expect(screen.queryByTestId(DOWNLOAD_VAULT_FILE_AUDIT_TEST_ID)).toBeDisabled());
    await waitFor(() => expect(screen.queryByTestId(DOWNLOAD_VAULT_FILE_AUDIT_TEST_ID)).toBeEnabled(), {
      timeout: 4000,
    });
  });
});
