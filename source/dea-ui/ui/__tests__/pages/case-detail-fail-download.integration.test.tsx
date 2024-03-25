import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, getByRole, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import Axios from 'axios';
import { auditLogLabels, caseDetailLabels } from '../../src/common/labels';
import { NotificationsProvider } from '../../src/context/NotificationsContext';
import CaseDetailsPage from '../../src/pages/case-detail';

afterEach(cleanup);

const CASE_ID = '100';
interface Query {
  caseId: string | object;
}
let query: Query = {
  caseId: CASE_ID,
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

const mockFilesRoot = {
  files: [
    {
      ulid: '01GV4J7C6D18WQVCBA7RAPXTT1',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      fileName: 'rootFile',
      contentType: 'application/octet-stream',
      createdBy: '01GV13XRYZE1VKY7TY88Y7RPH0',
      filePath: '/',
      fileSizeMb: 50,
      uploadId:
        'OEQeZM6D6jYzdHm6nnpXggWDlDhSZbZ1mcUe7JKdpfHP5zSnWlQ3kU.iz5v6zyOiQVvPqS9BfFixgBQgxRaa242L6XQyT2MwzUw7Nizk1pvXQJR_anulhvuvjGH_hpQ1x7ciO5yEDWEKTaxBF5vtxSryncXAFpHfBWBzSQi01Eou9I8PzadqnirZU0PBlN.3DxFuJP8pG2FTMHlBQSlEcA--',
      sha256Hash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      versionId: 'mwXq6KDGPfw8qD3oUeDNjh2dsSGWWHad',
      status: 'ACTIVE',
      created: '2023-03-10T01:30:04.877Z',
      updated: '2023-03-10T01:30:14.326Z',
      isFile: true,
    },
  ],
  total: 2,
};

const mockedCaseDetail = {
  ulid: CASE_ID,
  name: 'mocked case',
  status: 'ACTIVE',
};

const mockedCaseActions = {
  caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
  userUlid: '01GVHP0HP5V2A80XJZTHJH4QGD',
  userFirstName: 'John',
  userLastName: 'Doe',
  caseName: 'Investigation One',
  actions: [
    'VIEW_CASE_DETAILS',
    'UPDATE_CASE_DETAILS',
    'UPLOAD',
    'DOWNLOAD',
    'VIEW_FILES',
    'CASE_AUDIT',
    'INVITE',
  ],
  created: '2023-03-23T15:38:26.955Z',
  updated: '2023-03-23T15:38:26.955Z',
};

const mockedUsers = {
  users: [
    {
      ulid: '01GVHP0HP5V2A80XJZTHJH4QGD',
      firstName: 'Alejandro',
      lastName: 'Rosalez',
      created: '2023-03-15T03:46:23.045Z',
      updated: '2023-03-15T03:46:23.045Z',
    },
    {
      ulid: '01GVHP0HP5V2A80XJZTHJH4QGE',
      firstName: 'Carlos',
      lastName: 'Salazar',
      created: '2023-03-14T03:46:23.045Z',
      updated: '2023-03-14T03:46:23.045Z',
    },
  ],
};

const mockedCaseUsers = {
  caseUsers: [
    {
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      userUlid: '01GVHP0HP5V2A80XJZTHJH4QGE',
      caseName: 'Investigation One',
      actions: ['VIEW_CASE_DETAILS'],
      userFirstName: 'Carlos',
      userLastName: 'Salazar',
      created: '2023-03-15T03:46:23.045Z',
      updated: '2023-03-15T03:46:23.045Z',
    },
    {
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      userUlid: '01GVHP0HP5V2A80XJZTHJH4QGD',
      caseName: 'Investigation One',
      actions: ['INVITE'],
      userFirstName: 'Alejandro',
      userLastName: 'Rosalez',
      created: '2023-03-15T03:46:23.045Z',
      updated: '2023-03-15T03:46:23.045Z',
    },
  ],
};

let failingCall = -1;

const failingCsvResult = [{ status: 'Running' }, { status: 'Running' }, { status: 'Cancelled' }];

mockedAxios.create.mockReturnThis();
mockedAxios.request.mockImplementation((eventObj) => {
  if (eventObj.url?.endsWith(`${CASE_ID}/details`)) {
    return Promise.resolve({
      data: mockedCaseDetail,
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else if (eventObj.url?.endsWith(`${CASE_ID}/actions`)) {
    return Promise.resolve({
      data: mockedCaseActions,
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else if (eventObj.url?.endsWith(`${CASE_ID}/user-memberships`)) {
    if (eventObj.method === 'POST') {
      return Promise.resolve({
        data: {},
        status: 200,
        statusText: 'Ok',
        headers: {},
        config: {},
      });
    }
    return Promise.resolve({
      data: mockedCaseUsers,
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else if (eventObj.url?.includes('files?filePath=/')) {
    return Promise.resolve({
      data: mockFilesRoot,
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
  } else if (eventObj.url?.endsWith('csv')) {
    return Promise.resolve({
      data: failingCsvResult[++failingCall],
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else {
    // get users
    return Promise.resolve({
      data: mockedUsers,
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  }
});

describe('CaseDetailsPage', () => {
  it('recovers from a from a csv download failure', async () => {
    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const downloadCsvButton = await screen.findByText(auditLogLabels.downloadCSVLabel);
    fireEvent.click(downloadCsvButton);

    // upload button will be disabled while in progress and then re-enabled when done
    await waitFor(() => expect(screen.queryByTestId('download-case-audit-csv-button')).toBeDisabled());
    await waitFor(() => expect(screen.queryByTestId('download-case-audit-csv-button')).toBeEnabled(), {
      timeout: 4000,
    });
    // error notification is visible
    const notificationsWrapper = wrapper(page.container).findFlashbar()!;
    expect(notificationsWrapper).toBeTruthy();
  });
});
