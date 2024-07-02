import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Axios from 'axios';
import { breadcrumbLabels } from '../../src/common/labels';
import { NotificationsProvider } from '../../src/context/NotificationsContext';
import ManageCasePage from '../../src/pages/manage-case';

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
      } else if (eventObj.url?.includes('users?nameBeginsWith=')) {
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

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(2);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.homePageLabel);
    expect(breadcrumbLinks[1].getElement()).toHaveTextContent(
      `${breadcrumbLabels.manageCaseLabel} ${CASE_ID}`
    );

    // assert autosuggest component
    const searchUserInput = await screen.findByTestId('user-search-input');
    const searchUserInputWrapper = wrapper(page.container).findAutosuggest()!;
    expect(searchUserInput).toBeDefined();

    searchUserInputWrapper.focus();

    const textToInput = 'Carlos Salazar';
    const searchInput = await screen.findByRole('combobox');
    await user.type(searchInput, textToInput);
    await act(async () => {
      searchUserInputWrapper.selectSuggestionByValue(textToInput);
    });

    const addCaseMemberButton = await screen.findByRole('button', { name: 'Add' });
    fireEvent.click(addCaseMemberButton);
  }, 20000);

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
      } else if (eventObj.url?.includes('users?nameBeginsWith=')) {
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

    const textToInput = 'Carlos Salazar';
    const searchInput = await screen.findByRole('combobox');
    await user.type(searchInput, textToInput);
    await act(async () => {
      searchUserInputWrapper.selectSuggestionByValue(textToInput);
    });

    const addCaseMemberButton = await screen.findByRole('button', { name: 'Add' });
    fireEvent.click(addCaseMemberButton);
  }, 20000);
});
