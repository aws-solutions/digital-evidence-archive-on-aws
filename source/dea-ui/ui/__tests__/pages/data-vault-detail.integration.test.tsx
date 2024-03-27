import { QueryExecutionState } from '@aws-sdk/client-athena';
import { DeaDataVault } from '@aws/dea-app/lib/models/data-vault';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Axios from 'axios';
import { AuditResult } from '../../src/api/cases';
import { auditLogLabels } from '../../src/common/labels';
import {
  DATA_VAULTS_AUDIT_ENDPOINT,
  DATA_VAULTS_PUT_ENDPOINT,
  DOWNLOAD_AUDIT_TEST_ID,
} from '../../src/components/data-vault-details/DataVaultDetailsBody';
import DataVaultDetailsPage from '../../src/pages/data-vault-detail';
import { DeaDataVaultFile } from '@aws/dea-app/lib/models/data-vault-file';
import { DeaCaseDTO } from '../../src/api/models/case';

afterEach(cleanup);

const DATAVAULT_ID = '100';
const FILE_ID = '200';
interface Query {
  dataVaultId: string | object;
  fileId: string | object;
}
let query: Query = {
  dataVaultId: DATAVAULT_ID,
  fileId: FILE_ID,
};
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((key: keyof Query) => query[key]),
  }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

global.fetch = jest.fn(() => Promise.resolve({ blob: () => Promise.resolve('foo') }));
global.window.URL.createObjectURL = jest.fn(() => {});
HTMLAnchorElement.prototype.click = jest.fn();

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const mockedDatavaultDetails: DeaDataVault = {
  name: 'DATAVAULT_NAME',
  ulid: 'DATAVAULT_ID',
  created: new Date(),
  updated: new Date(),
  totalSizeBytes: 1,
  objectCount: 1,
};

const mockedFileList: DeaDataVaultFile[] = [];

const mockedCaseList: DeaCaseDTO[] = [];

let csvCall = -1;
const csvResult: AuditResult[] = [
  { status: QueryExecutionState.RUNNING, downloadUrl: undefined },
  { status: QueryExecutionState.RUNNING, downloadUrl: undefined },
  { status: QueryExecutionState.SUCCEEDED, downloadUrl: 'url' },
];

mockedAxios.create.mockReturnThis();
mockedAxios.request.mockImplementation((eventObj) => {
  if (eventObj.url?.endsWith(`${DATAVAULT_ID}/details`)) {
    return Promise.resolve({
      data: mockedDatavaultDetails,
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
        endpoints: [DATA_VAULTS_PUT_ENDPOINT, DATA_VAULTS_AUDIT_ENDPOINT],
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else if (eventObj.url?.includes('files')) {
    return Promise.resolve({
      data: {
        files: mockedCaseList,
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else if (eventObj.url?.includes('all-cases')) {
    return Promise.resolve({
      data: {
        cases: mockedCaseList,
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

describe('DatavaultDetailPage', () => {
  it('downloads a datavault audit', async () => {
    const page = render(<DataVaultDetailsPage />);
    expect(page).toBeTruthy();

    const downloadCsvButton = await screen.findByText(auditLogLabels.dataVaultAuditLogLabel);
    fireEvent.click(downloadCsvButton);

    // upload button will be disabled while in progress and then re-enabled when done
    await waitFor(() => expect(screen.queryByTestId(DOWNLOAD_AUDIT_TEST_ID)).toBeDisabled());
    await waitFor(() => expect(screen.queryByTestId(DOWNLOAD_AUDIT_TEST_ID)).toBeEnabled(), {
      timeout: 4000,
    });
  });
});
