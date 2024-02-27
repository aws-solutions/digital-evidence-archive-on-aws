import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, fireEvent, getByRole, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import Axios from 'axios';
import { auditLogLabels, caseDetailLabels, commonLabels } from '../../src/common/labels';
import { NotificationsProvider } from '../../src/context/NotificationsContext';
import CaseDetailsPage from '../../src/pages/case-detail';

const push = jest.fn();

const CASE_ID = '01GV15BH762P6MW1QH8EQDGBFQ';
const CASE_NAME = 'fakecase';
interface Query {
  caseId: string | object;
  caseName: string | object;
  fileId?: string | object;
  fileName?: string | object;
}
let query: Query = {
  caseId: CASE_ID,
  caseName: CASE_NAME,
};
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((key: keyof Query) => query[key]),
  }),
  useRouter: () => ({
    push,
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
      created: '2023-03-11T17:08:40.682Z',
      updated: '2023-03-11T17:08:40.682Z',
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
    {
      ulid: '01GV4J7C6D18WQVCBA7RAPXTT2',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      fileName: 'rootFile2',
      contentType: 'application/octet-stream',
      createdBy: '01GV13XRYZE1VKY7TY88Y7RPH0',
      filePath: '/',
      fileSizeMb: 50,
      uploadId:
        'OEQeZM6D6jYzdHm6nnpXggWDlDhSZbZ1mcUe7JKdpfHP5zSnWlQ3kU.iz5v6zyOiQVvPqS9BfFixgBQgxRaa242L6XQyT2MwzUw7Nizk1pvXQJR_anulhvuvjGH_hpQ1x7ciO5yEDWEKTaxBF5vtxSryncXAFpHfBWBzSQi01Eou9I8PzadqnirZU0PBlN.3DxFuJP8pG2FTMHlBQSlEcB--',
      sha256Hash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      versionId: 'mwXq6KDGPfw8qD3oUeDNjh2dsSGWWHad',
      status: 'INACTIVE',
      created: '2023-03-10T01:30:04.877Z',
      updated: '2023-03-10T01:30:14.326Z',
      isFile: true,
    },
    {
      ulid: '01HD2SGVA662N6TMREH510BWZW',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      fileName: 'a-folder',
      contentType: 'Directory',
      createdBy: '01GV13XRYZE1VKY7TY88Y7RPH0',
      filePath: '/',
      fileSizeMb: 0,
      status: 'ACTIVE',
      created: '2023-03-11T17:08:40.682Z',
      updated: '2023-03-11T17:08:40.682Z',
      isFile: false,
    },
    {
      ulid: '01HD2SGVHV8DEAZQP5ZEEZ6F81',
      fileName: 'README.md',
      filePath: '/a-folder/',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      isFile: true,
      fileSizeMb: 458,
      createdBy: 'John Doe',
      contentType: 'md',
      sha256Hash: 'SHA256:52773d75ca79b81253ad1409880ab061d66f0e5bbcc1e820b008e7617c78d745',
      status: 'ACTIVE',
      created: '2023-03-10T01:30:04.877Z',
      updated: '2023-03-10T01:30:14.326Z',
    },
    {
      ulid: '01HD2SGVHV8DEAZQP5ZEEZ6F81',
      fileName: 'API.md',
      filePath: '/a-folder/',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      isFile: true,
      fileSizeMb: 458,
      createdBy: 'John Doe',
      contentType: 'md',
      sha256Hash: 'SHA256:52773d75ca79b81253ad1409880ab061d66f0e5bbcc1e820b008e7617c78d745',
      status: 'ACTIVE',
      created: '2023-03-10T01:30:04.877Z',
      updated: '2023-03-10T01:30:14.326Z',
    },
  ],
  total: 2,
};

const mockFilesFood = {
  files: [
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
  ulid: CASE_ID,
  name: CASE_NAME,
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

let csvCall = -1;

const csvResult = [{ status: 'Running' }, { status: 'Running' }, 'csvresults'];

const ACTIVE_USER_ID = mockedUsers.users[0].ulid;
const OTHER_USER_ID = mockedUsers.users[1].ulid;

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
  } else if (eventObj.url?.endsWith(`${CASE_ID}/userMemberships`)) {
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
  } else if (eventObj.url?.endsWith(`${CASE_ID}/users/${ACTIVE_USER_ID}/memberships`)) {
    if (eventObj.method === 'DELETE') {
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
  } else if (eventObj.url?.includes('files?filePath=/food/')) {
    return Promise.resolve({
      data: mockFilesFood,
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
      data: csvResult[++csvCall],
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
  it('renders a case details page', async () => {
    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const mockedCaseInfo = await screen.findAllByText(CASE_NAME);
    expect(mockedCaseInfo.length).toEqual(2); // Header and breadcrumb
    expect(mockedCaseInfo).toBeTruthy();

    const table = await screen.findByTestId('file-table');
    const tableWrapper = wrapper(table);
    // the table exists
    expect(table).toBeTruthy();

    const folderEntry = await screen.findByTestId('food-button');
    const fileEntry = await screen.findByTestId('rootFile-file-button');
    // the folder button exists
    expect(folderEntry).toBeTruthy();
    // the file exists as a box
    expect(fileEntry).toBeTruthy();

    const textFilter = tableWrapper.findTextFilter();
    if (!textFilter) {
      fail();
    }
    const textFilterInput = textFilter.findInput();
    textFilterInput.setInputValue('food');

    // after filtering, rootFile will not be visible
    await waitFor(() => expect(screen.queryByTestId('rootFile-file-button')).toBeNull());

    // clear the filter
    textFilterInput.setInputValue('');
    await waitFor(() => expect(screen.queryByTestId('rootFile-file-button')).toBeDefined());

    // click on the folder to navigate
    fireEvent.click(folderEntry);

    // we should now see the new file "sushi.png"
    await waitFor(() => expect(screen.getByTestId('sushi.png-file-button')).toBeDefined());

    const breadcrumb = wrapper(page.container).findBreadcrumbGroup();

    await waitFor(() => expect(breadcrumb?.findBreadcrumbLinks().length).toEqual(2));

    // click the breadcrumb to return to the root
    const rootLink = await screen.findByText('/');
    fireEvent.click(rootLink);

    // should find the original rows again
    await screen.findByTestId('food-button');
    await screen.findByTestId('rootFile-file-button');
  });

  it('navigates to manage access page', async () => {
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

    const textToInput = 'Carlos Salazar';
    const searchInput = await screen.findByTestId('manage-access-search-user-form-combobox');

    await act(async () => {
      await userEvent.type(searchInput, textToInput);
      searchUserInputWrapper.selectSuggestionByValue(textToInput);
    });

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

    //assert save button
    const saveButton = await screen.findByRole('button', { name: commonLabels.saveUpdatesButton });
    expect(saveButton).toBeTruthy();
    await act(async () => {
      saveButton.click();
    });

    // assert remove button
    await waitFor(() => expect(screen.queryByTestId(`${ACTIVE_USER_ID}-remove-button`)).toBeDisabled());
    const removeButton = await screen.queryByTestId(`${OTHER_USER_ID}-remove-button`);
    expect(removeButton).toBeEnabled();
    await act(async () => {
      removeButton.click();
    });

    // assert remove modal
    const removeModalWrapper = wrapper(document.body).findModal()!;
    expect(removeModalWrapper).toBeTruthy();
    expect(removeModalWrapper.isVisible()).toBeTruthy();
    // click on dismiss button should close the modal.
    await act(async () => {
      removeModalWrapper.findDismissButton().click();
    });
    expect(removeModalWrapper.isVisible()).toBeFalsy();
    // asert modal submit button
    await act(async () => {
      removeButton.click();
    });
    const modalSubmitButton = await getByRole(removeModalWrapper.getElement(), 'button', { name: 'Remove' });
    await act(async () => {
      modalSubmitButton.click();
    });
    expect(removeModalWrapper.isVisible()).toBeFalsy();

    //assert notifications
    const notificationsWrapper = wrapper(page.container).findFlashbar()!;
    expect(notificationsWrapper).toBeTruthy();
    waitFor(() => expect(notificationsWrapper.findItems().length).toEqual(1));
    const item = notificationsWrapper.findItems()[0];
    await act(async () => {
      item.findDismissButton()!.click();
    });
  }, 30000);

  it('navigates to upload files page', async () => {
    query = {
      caseId: CASE_ID,
      caseName: mockedCaseDetail.name,
    };

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const uploadButton = await page.findByTestId('upload-file-button');
    fireEvent.click(uploadButton);

    expect(push).toHaveBeenCalledWith(
      `/upload-files?caseId=${CASE_ID}&filePath=/&caseName=${mockedCaseDetail.name}`
    );
  });

  it('downloads a case audit', async () => {
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

  it('navigates to file details page', async () => {
    query = {
      caseId: CASE_ID,
      fileId: mockFilesRoot.files[1].ulid,
      caseName: mockedCaseDetail.name,
      fileName: mockFilesRoot.files[1].fileName,
    };

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const fileEntry = await screen.findByTestId('rootFile-file-button');
    fireEvent.click(fileEntry);

    expect(push).toHaveBeenCalledWith(
      `/file-detail?caseId=${mockFilesRoot.files[1].caseUlid}&fileId=${mockFilesRoot.files[1].ulid}&caseName=${mockedCaseDetail.name}`
    );
  });

  it('resets the filter on folder navigation', async () => {
    const page = render(<CaseDetailsPage />);
    const pageWrapper = wrapper(page.baseElement);

    const headerWrapper = pageWrapper.findHeader();
    if (!headerWrapper) fail();
    expect(headerWrapper.findHeadingText().getElement()).toHaveTextContent(CASE_NAME);

    // navigates inside the folder
    const folderEntry = await screen.findByText('a-folder');
    expect(folderEntry).toBeTruthy();
    fireEvent.click(folderEntry);

    // filters by text
    const table = await screen.findByTestId('file-table');
    const tableWrapper = wrapper(table);
    const textFilter = tableWrapper.findTextFilter();
    if (!textFilter) {
      fail();
    }
    const textFilterInput = textFilter.findInput();
    textFilterInput.setInputValue('README.md');

    // after filtering, README.md should be visible but API.md should not.
    await waitFor(() => expect(screen.queryByTestId('README.md-file-button')).toBeTruthy());
    await waitFor(() => expect(screen.queryByTestId('API.md-file-button')).toBeFalsy());

    // click the breadcrumb to return to the root
    const rootLink = await screen.findByText('/');
    fireEvent.click(rootLink);

    // upon clicking the link in the breadcrumb the filter text should be reset.
    await waitFor(() => expect(textFilterInput.getInputValue()).toBeFalsy());
  });
});
