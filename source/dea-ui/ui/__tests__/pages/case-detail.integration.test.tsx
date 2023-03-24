import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import axios from 'axios';
import { delay } from '../../src/api/cases';
import { auditLogLabels, caseDetailLabels, commonLabels } from '../../src/common/labels';
import { NotificationsProvider } from '../../src/context/NotificationsContext';
import CaseDetailsPage from '../../src/pages/case-detail';

const user = userEvent.setup();
const push = jest.fn();
const CASE_ID = '100';
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { caseId: CASE_ID },
    push,
  })),
}));

global.fetch = jest.fn(() => Promise.resolve({ blob: () => Promise.resolve('foo') }));
global.window.URL.createObjectURL = jest.fn(() => {});
HTMLAnchorElement.prototype.click = jest.fn();

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

const mockFilesRoot = {
  cases: [
    {
      ulid: '01GV3NH93AX2GYHBQNVR27NEMJ',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      fileName: 'food',
      contentType: 'application/octet-stream',
      createdBy: '01GV13XRYZE1VKY7TY88Y7RPH0',
      filePath: '/',
      fileSizeMb: 50,
      uploadId:
        'aiV5S5CTX6FSWerMkYsVw9vXDp8Xes2gyEDQPPxI4b7LZjk8fKPOFrX7cn_bOupAE.xZ9M0d2HkB_075dVSYsAOKhixAN987_YXJbyUulyWgW8ORp93oRO1U0WMwhmxTE7o5gWoiJlHuVIZptds8Thgpac.4K9ChEeh2Sac35kNGH43XoSFadbzzcWCB9ZKFGP9P0gxfxRlSg4YdTyXIaw--',
      sha256Hash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      versionId: '8pXrPWVxZoRiCszVYB2lShmCoxWH9Fca',
      status: 'ACTIVE',
      created: '2023-03-09T17:08:40.682Z',
      updated: '2023-03-09T17:08:40.682Z',
      isFile: false,
      ttl: 1678385311,
    },
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

const mockFilesFood = {
  cases: [
    {
      ulid: '01GV3NH93AX2GYHBQNVR27NEMJ',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      fileName: 'sushi.png',
      contentType: 'application/octet-stream',
      createdBy: '01GV13XRYZE1VKY7TY88Y7RPH0',
      filePath: '/food',
      fileSizeMb: 50,
      uploadId:
        'aiV5S5CTX6FSWerMkYsVw9vXDp8Xes2gyEDQPPxI4b7LZjk8fKPOFrX7cn_bOupAE.xZ9M0d2HkB_075dVSYsAOKhixAN987_YXJbyUulyWgW8ORp93oRO1U0WMwhmxTE7o5gWoiJlHuVIZptds8Thgpac.4K9ChEeh2Sac35kNGH43XoSFadbzzcWCB9ZKFGP9P0gxfxRlSg4YdTyXIaw--',
      sha256Hash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      versionId: '8pXrPWVxZoRiCszVYB2lShmCoxWH9Fca',
      status: 'ACTIVE',
      created: '2023-03-09T17:08:40.682Z',
      updated: '2023-03-09T17:08:40.682Z',
      isFile: true,
      ttl: 1678385311,
    },
  ],
  total: 1,
};

const mockedCaseDetail = {
  ulid: 'abc',
  name: 'mocked case',
  status: 'ACTIVE',
};

const mockedCaseActions = {
  caseUlid: '01GW7HY47X74PSW7QNHZX7EE0H',
  userUlid: '01GW5N0SKHSXDBMFBKMDB82TAQ',
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
      firstName: 'Albert',
      lastName: 'York',
      created: '2023-03-15T03:46:23.045Z',
      updated: '2023-03-15T03:46:23.045Z',
    },
    {
      ulid: '01GVHP0HP5V2A80XJZTHJH4QGE',
      firstName: 'Bee',
      lastName: 'Dalton',
      created: '2023-03-14T03:46:23.045Z',
      updated: '2023-03-14T03:46:23.045Z',
    },
  ],
};

const mockedCaseUsers = {
  caseUsers: [
    {
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      ulid: '01GVHP0HP5V2A80XJZTHJH4QGD',
      caseName: 'Investigation One',
      actions: ['INVITE'],
      userFirstName: 'Albert',
      userLastName: 'York',
      created: '2023-03-15T03:46:23.045Z',
      updated: '2023-03-15T03:46:23.045Z',
    },
  ],
};

let csvCall = -1;
let failingCall = -1;

const csvResult = [{ status: 'Running' }, { status: 'Running' }, 'csvresults'];

const failingCsvResult = [{ status: 'Running' }, { status: 'Running' }, { status: 'Cancelled' }];

describe('CaseDetailsPage', () => {
  it('renders a case details page', async () => {
    mockedAxios.mockImplementation((event) => {
      const eventObj: any = event;
      if (eventObj.url === 'https://localhostcases/100/details') {
        return Promise.resolve({
          data: mockedCaseDetail,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/100/actions') {
        return Promise.resolve({
          data: mockedCaseActions,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/100/files?filePath=/food/') {
        return Promise.resolve({
          data: mockFilesFood,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: mockFilesRoot,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const mockedCaseInfo = await screen.findByText('mocked case');
    expect(mockedCaseInfo).toBeTruthy();

    const table = await screen.findByTestId('file-table');
    const tableWrapper = wrapper(table);
    // the table exists
    expect(table).toBeTruthy();

    const folderEntry = await screen.findByTestId('food-button');
    const fileEntry = await screen.findByTestId('rootFile-box');
    // the folder button exists
    expect(folderEntry).toBeTruthy();
    // the file exists as a box
    expect(fileEntry).toBeTruthy();

    // const textFilter = await screen.findByTestId('files-text-filter');
    const textFilter = tableWrapper.findTextFilter();
    if (!textFilter) {
      fail();
    }
    const textFilterInput = textFilter.findInput();
    textFilterInput.setInputValue('food');

    // after filtering, rootFile will not be visible
    await waitFor(() => expect(screen.queryByTestId('rootFile-box')).toBeNull());

    // click on the folder to navigate
    fireEvent.click(folderEntry);

    // clear the filter
    textFilterInput.setInputValue('');

    // we should now see the new file "sushi.png"
    await screen.findByTestId('sushi.png-box');
    const breadcrumb = tableWrapper.findBreadcrumbGroup();
    if (!breadcrumb) {
      fail();
    }
    const links = breadcrumb.findBreadcrumbLinks();
    expect(links.length).toEqual(2);

    // click the breadcrumb to return to the root
    const rootLink = await screen.findByText('/');
    fireEvent.click(rootLink);

    // should find the original rows again
    await screen.findByTestId('food-button');
    await screen.findByTestId('rootFile-box');
  });

  it('navigates to manage access page', async () => {
    const USER_ID = '01GVHP0HP5V2A80XJZTHJH4QGE';
    mockedAxios.mockImplementation((event) => {
      const eventObj: any = event;
      if (eventObj.url === `https://localhostcases/${CASE_ID}/details`) {
        return Promise.resolve({
          data: mockedCaseDetail,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/100/actions') {
        return Promise.resolve({
          data: mockedCaseActions,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === `https://localhostcases/${CASE_ID}/userMemberships`) {
        if (eventObj.method === 'post') {
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
      } else if (eventObj.url === `https://localhostcases/${CASE_ID}//users/${USER_ID}/memberships`) {
        if (eventObj.method === 'delete') {
          return Promise.resolve({
            data: {},
            status: 200,
            statusText: 'Ok',
            headers: {},
            config: {},
          });
        }
        // put
        return Promise.resolve({
          data: {},
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

    const page = render(
      <NotificationsProvider>
        <CaseDetailsPage />
      </NotificationsProvider>
    );
    expect(page).toBeTruthy();

    const tab = await screen.findByText(caseDetailLabels.manageAccessLabel);
    fireEvent.click(tab);

    // assert autosuggest component
    const searchUserInput = await screen.findByTestId('user-search-input');
    const searchUserInputWrapper = wrapper(page.container).findAutosuggest()!;
    expect(searchUserInput).toBeTruthy();
    searchUserInputWrapper.focus();

    for (let index = 0; index < mockedUsers.users.length; index++) {
      const user = mockedUsers.users[index];
      const optionValue = `${user.firstName} ${user.lastName}`;
      expect(searchUserInputWrapper.findDropdown().findOptionByValue(optionValue)!.getElement()).toBeTruthy();
    }

    const textToInput = 'Albert York';
    const searchInput = await screen.findByRole('combobox', {
      description:
        'Members added or removed will be notified by email. Their access to case details will be based on permissions set.',
    });
    await userEvent.type(searchInput, textToInput);
    searchUserInputWrapper.selectSuggestionByValue(textToInput);

    const addCaseMemberButton = await screen.findByRole('button', { name: 'Add' });
    await act(async () => {
      addCaseMemberButton.click();
    });

    // assert multiselect component
    const permissionsWrapper = wrapper(page.container).findMultiselect()!;
    expect(permissionsWrapper).toBeTruthy();
    expect(permissionsWrapper.findTokens()).toHaveLength(1);
    permissionsWrapper.openDropdown();
    permissionsWrapper.selectOption(1);

    // assert remove button
    const removeButton = await screen.findByRole('button', { name: 'Remove' });
    expect(removeButton).toBeTruthy();
    await act(async () => {
      removeButton.click();
    });

    //assert notifications
    const notificationsWrapper = wrapper(page.container).findFlashbar()!;
    notificationsWrapper.findItems()[0].findDismissButton()!.click();
    await delay(100);
    expect(notificationsWrapper).toBeTruthy();
  });

  it('navigates to upload files page', async () => {
    mockedAxios.mockImplementation((event) => {
      const eventObj: any = event;
      if (eventObj.url === 'https://localhostcases/100/actions') {
        return Promise.resolve({
          data: mockedCaseActions,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: mockedCaseDetail,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });
    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const uploadButton = await screen.findByText(commonLabels.uploadButton);
    fireEvent.click(uploadButton);
    expect(push).toHaveBeenCalledWith(`/upload-files?caseId=${CASE_ID}&filePath=/`);
  });

  it('downloads selected files', async () => {
    mockedAxios.mockImplementation(async (event) => {
      const eventObj: any = event;
      if (eventObj.url === 'https://localhostcases/100/details') {
        return Promise.resolve({
          data: mockedCaseDetail,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/100/actions') {
        return Promise.resolve({
          data: mockedCaseActions,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        await delay(100);
        return Promise.resolve({
          data: mockFilesRoot,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const table = await screen.findByTestId('file-table');
    const tableWrapper = wrapper(table);
    expect(table).toBeTruthy();

    const fileSelector = await tableWrapper.findCheckbox();
    if (!fileSelector) {
      fail();
    }
    fileSelector.click();

    const downloadButton = await screen.findByText(commonLabels.downloadButton);
    fireEvent.click(downloadButton);

    // upload button will be disabled while in progress and then re-enabled when done
    await waitFor(() => expect(screen.queryByTestId('download-file-button')).toBeDisabled());
    await waitFor(() => expect(screen.queryByTestId('download-file-button')).toBeEnabled());
  });

  it('downloads a case audit', async () => {
    mockedAxios.mockImplementation((event) => {
      const eventObj: any = event;
      if (eventObj.url === 'https://localhostcases/100/details') {
        return Promise.resolve({
          data: mockedCaseDetail,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/100/actions') {
        return Promise.resolve({
          data: mockedCaseActions,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/abc/audit') {
        return Promise.resolve({
          data: { auditId: '11111111-1111-1111-1111-111111111111' },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (
        eventObj.url === 'https://localhostcases/abc/audit/11111111-1111-1111-1111-111111111111/csv'
      ) {
        return Promise.resolve({
          data: csvResult[++csvCall],
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: mockFilesRoot,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const downloadCsvButton = await screen.findByText(auditLogLabels.downloadCSVLabel);
    fireEvent.click(downloadCsvButton);

    // upload button will be disabled while in progress and then re-enabled when done
    await waitFor(() => expect(screen.queryByTestId('download-case-audit-csv-button')).toBeDisabled());
    await waitFor(() => expect(screen.queryByTestId('download-case-audit-csv-button')).toBeEnabled(), {
      timeout: 4000,
    });
  });

  it('recovers from a from a csv download failure', async () => {
    mockedAxios.mockImplementation((event) => {
      const eventObj: any = event;
      if (eventObj.url === 'https://localhostcases/100/details') {
        return Promise.resolve({
          data: mockedCaseDetail,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/100/actions') {
        return Promise.resolve({
          data: mockedCaseActions,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/abc/audit') {
        return Promise.resolve({
          data: { auditId: '11111111-1111-1111-1111-111111111111' },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (
        eventObj.url === 'https://localhostcases/abc/audit/11111111-1111-1111-1111-111111111111/csv'
      ) {
        return Promise.resolve({
          data: failingCsvResult[++failingCall],
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: mockFilesRoot,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

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
