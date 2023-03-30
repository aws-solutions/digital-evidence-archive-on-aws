import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fail } from 'assert';
import axios from 'axios';
import { caseListLabels } from '../../src/common/labels';
import { i18nStrings } from '../../src/components/common-components/commonDefinitions';
import Home from '../../src/pages';
import AllCasesPage from '../../src/pages/all-cases';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const push = jest.fn();

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  })),
}));

describe('All Cases Dashboard', () => {
  it('renders a list of cases', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith('all-cases')) {
        return Promise.resolve({
          data: {
            cases: [
              {
                ulid: 'abc',
                name: 'mocked case',
                status: 'ACTIVE',
              },
              {
                ulid: 'def',
                name: 'case2',
                status: 'ACTIVE',
              },
            ],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        //availableEndpoints
        return Promise.resolve({
          data: {
            endpoints: ['/cases/all-casesGET', '/cases/my-casesGET'],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const page = render(<AllCasesPage />);
    const pagewrapper = wrapper(page.baseElement);

    await waitFor(() => expect(pagewrapper.findSideNavigation()).toBeDefined());
    const sideNav = pagewrapper.findSideNavigation();
    if (!sideNav) {
      fail();
    }

    // it has both my cases and all cases links
    const myCasesLink = sideNav.findLinkByHref('/');
    expect(myCasesLink).toBeDefined();
    const allCasesLink = sideNav.findLinkByHref('/all-cases');
    expect(allCasesLink).toBeDefined();

    const createCaseButton = screen.queryByText(caseListLabels.createNewCaseLabel);
    expect(createCaseButton).toBeNull();
  });

  it('navigates to manage case details', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: {
        cases: [
          {
            ulid: 'abc',
            name: 'mocked case',
            status: 'ACTIVE',
          },
        ],
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
    render(<AllCasesPage />);

    const table = await screen.findByTestId('case-table');
    const link = wrapper(table).findLink();

    if (!link) {
      fail();
    }
    link.click();

    expect(push).toHaveBeenCalledWith('/manage-case?caseId=abc');
  });
});
