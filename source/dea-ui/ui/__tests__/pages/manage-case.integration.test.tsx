import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, getByRole, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import Axios from 'axios';
import { auditLogLabels, caseDetailLabels, commonLabels } from '../../src/common/labels';
import { NotificationsProvider } from '../../src/context/NotificationsContext';
import CaseDetailsPage from '../../src/pages/case-detail';
import ManageCasePage from '../../src/pages/manage-case';

afterEach(cleanup);

const CASE_ID = '100';
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { caseId: CASE_ID },
  })),
}));

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const mockedScopedCaseInfo = {
  ulid: 'abc',
  name: 'mocked case',
};

const mockedCaseUser = {
  caseUlid: CASE_ID,
  userUlid: '123user',
  actions: [],
  caseName: 'caseyjones',
  userFirstName: 'first',
  userLastName: 'last',
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

describe('Manage Case Page', () => {
  it('allows assignment of an owner', async () => {
    const user = userEvent.setup();
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith('scopedInformation')) {
        return Promise.resolve({
          data: mockedScopedCaseInfo,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith('users?nameBeginsWith=')) {
        // get users
        return Promise.resolve({
          data: mockedUsers,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith('owner')) {
        return Promise.resolve({
          data: mockedCaseUser,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: [],
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const page = render(
      <NotificationsProvider>
        <ManageCasePage />
      </NotificationsProvider>
    );
    expect(page).toBeDefined();

    // assert autosuggest component
    const searchUserInput = await screen.findByTestId('user-search-input');
    const searchUserInputWrapper = wrapper(page.container).findAutosuggest()!;
    expect(searchUserInput).toBeDefined();

    searchUserInputWrapper.focus();

    const textToInput = 'Bee Dalton';
    const searchInput = await screen.findByRole('combobox');
    await user.type(searchInput, textToInput);
    await act(async () => {
      searchUserInputWrapper.selectSuggestionByValue(textToInput);
    });

    const addCaseMemberButton = await screen.findByRole('button', { name: 'Add' });
    fireEvent.click(addCaseMemberButton);

    //assert notifications
    const notificationsWrapper = wrapper(page.container).findFlashbar()!;
    expect(notificationsWrapper).toBeTruthy();
    await waitFor(() => expect(notificationsWrapper.findItems().length).toEqual(1), { timeout: 2000 });
    const item1 = notificationsWrapper.findItems()[0];
    expect(item1.findContent()?.getElement()?.textContent).toContain('successfully assigned');
  });

  it('notifies of failure to assign an owner', async () => {
    const user = userEvent.setup();
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith('scopedInformation')) {
        return Promise.resolve({
          data: mockedScopedCaseInfo,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith('users?nameBeginsWith=')) {
        // get users
        return Promise.resolve({
          data: mockedUsers,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith('owner')) {
        return Promise.reject({
          data: '',
          status: 500,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: [],
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const page = render(
      <NotificationsProvider>
        <ManageCasePage />
      </NotificationsProvider>
    );
    expect(page).toBeDefined();

    // assert autosuggest component
    const searchUserInput = await screen.findByTestId('user-search-input');
    const searchUserInputWrapper = wrapper(page.container).findAutosuggest()!;
    expect(searchUserInput).toBeDefined();

    searchUserInputWrapper.focus();

    const textToInput = 'Bee Dalton';
    const searchInput = await screen.findByRole('combobox');
    await user.type(searchInput, textToInput);
    await act(async () => {
      searchUserInputWrapper.selectSuggestionByValue(textToInput);
    });

    const addCaseMemberButton = await screen.findByRole('button', { name: 'Add' });
    fireEvent.click(addCaseMemberButton);

    //assert notifications
    const notificationsWrapper = wrapper(page.container).findFlashbar()!;
    expect(notificationsWrapper).toBeDefined();
    await waitFor(() => expect(notificationsWrapper.findItems().length).toEqual(1));
    const item1 = notificationsWrapper.findItems()[0];
    expect(item1.findContent()?.getElement()?.textContent).toContain('Failed to assign');
  });
});
