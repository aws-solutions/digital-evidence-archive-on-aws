import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { fail } from 'assert';
import axios from 'axios';
import { breadcrumbLabels, caseListLabels } from '../../src/common/labels';
import AllCasesPage from '../../src/pages/all-cases';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const push = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  })),
}));

describe('All Cases Dashboard', () => {
  it('renders a list of cases', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.includes('all-cases')) {
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
        //available-endpoints
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

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(1);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.homePageLabel);
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
