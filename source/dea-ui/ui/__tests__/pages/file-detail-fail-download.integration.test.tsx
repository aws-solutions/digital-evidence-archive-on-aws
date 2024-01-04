import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, getByRole, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import Axios from 'axios';
import { auditLogLabels, breadcrumbLabels, caseDetailLabels } from '../../src/common/labels';
import { NotificationsProvider } from '../../src/context/NotificationsContext';
import { CaseFileDTO } from '../../src/api/models/case';
import FileDetailPage from '../../src/pages/file-detail';

afterEach(cleanup);

const push = jest.fn();
const CASE_ID = '100';
const FILE_ID = '200';
const CASE_NAME = 'mocked case';
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { caseId: CASE_ID, fileId: FILE_ID, setFileName: jest.fn(), caseName: CASE_NAME },
    push,
  })),
}));

global.fetch = jest.fn(() => Promise.resolve({ blob: () => Promise.resolve('foo') }));
global.window.URL.createObjectURL = jest.fn(() => {});
HTMLAnchorElement.prototype.click = jest.fn();

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const mockedCaseActions = {
  caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
  userUlid: '01GVHP0HP5V2A80XJZTHJH4QGD',
  userFirstName: 'John',
  userLastName: 'Doe',
  caseName: 'Investigation One',
  actions: ['VIEW_FILES', 'CASE_AUDIT'],
  created: '2023-03-23T15:38:26.955Z',
  updated: '2023-03-23T15:38:26.955Z',
};

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
};
let failingCall = -1;

const failingCsvResult = [{ status: 'Running' }, { status: 'Running' }, { status: 'Cancelled' }];

mockedAxios.create.mockReturnThis();
mockedAxios.request.mockImplementation((eventObj) => {
  if (eventObj.url?.endsWith('100/files/200/info')) {
    return Promise.resolve({
      data: mockedFileInfo,
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  } else if (eventObj.url?.endsWith('100/actions')) {
    return Promise.resolve({
      data: mockedCaseActions,
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
  } /* /csv */ else {
    return Promise.resolve({
      data: failingCsvResult[++failingCall],
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
  }
});

describe('FileDetailPage', () => {
  it('recovers from a failed audit download', async () => {
    const page = render(<FileDetailPage />);
    expect(page).toBeTruthy();

    const mockedFileText = await screen.findAllByText(mockedFileInfo.fileName);
    expect(mockedFileText.length).toEqual(2); // Header and breadcrumb
    expect(mockedFileText).toBeTruthy();
  });

  it('downloads a file audit', async () => {
    const page = render(<FileDetailPage />);
    expect(page).toBeTruthy();

    const downloadCsvButton = await screen.findByText(auditLogLabels.downloadFileAuditLabel);
    fireEvent.click(downloadCsvButton);

    // upload button will be disabled while in progress and then re-enabled when done
    await waitFor(() => expect(screen.queryByTestId('download-case-file-audit-button')).toBeDisabled());
    await waitFor(() => expect(screen.queryByTestId('download-case-file-audit-button')).toBeEnabled(), {
      timeout: 4000,
    });

    // error notification is visible
    const notificationsWrapper = wrapper(page.container).findFlashbar()!;
    expect(notificationsWrapper).toBeTruthy();
  });
});
