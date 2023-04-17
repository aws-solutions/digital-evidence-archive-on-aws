import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fail } from 'assert';
import axios from 'axios';
import { breadcrumbLabels, caseListLabels } from '../../src/common/labels';
import { i18nStrings } from '../../src/components/common-components/commonDefinitions';
import Home from '../../src/pages';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const push = jest.fn();

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  })),
}));

describe('Dashboard', () => {
  beforeAll(() => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith('availableEndpoints')) {
        return Promise.resolve({
          data: {
            endpoints: ['/casesPOST'],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
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
      }
    });
  });

  it('renders a list of cases', async () => {
    const page = render(<Home />);
    const listItem = await screen.findByText('mocked case');

    expect(page).toBeTruthy();
    expect(listItem).toBeTruthy();

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(1);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.homePageLabel);
  });

  it('navigates to create a new case', async () => {
    render(<Home />);

    const createCaseButton = await screen.findByText(caseListLabels.createNewCaseLabel);
    await waitFor(() => expect(createCaseButton).toBeEnabled());
    fireEvent.click(createCaseButton);
    expect(push).toHaveBeenCalledWith('/create-cases');
  });

  it('navigates to create case details', async () => {
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
    render(<Home />);

    const table = await screen.findByTestId('case-table');
    const link = wrapper(table).findLink();

    if (!link) {
      fail();
    }
    link.click();

    expect(push).toHaveBeenCalledWith('/case-detail?caseId=abc');
  });

  it('test for table property filter ii8nStrings', () => {
    expect(i18nStrings).toEqual({
      filteringAriaLabel: 'your choice',
      dismissAriaLabel: 'Dismiss',
      filteringPlaceholder: 'Search',
      groupValuesText: 'Values',
      groupPropertiesText: 'Properties',
      operatorsText: 'Operators',
      operationAndText: 'and',
      operationOrText: 'or',
      operatorLessText: 'Less than',
      operatorLessOrEqualText: 'Less than or equal',
      operatorGreaterText: 'Greater than',
      operatorGreaterOrEqualText: 'Greater than or equal',
      operatorContainsText: 'Contains',
      operatorDoesNotContainText: 'Does not contain',
      operatorEqualsText: 'Equals',
      operatorDoesNotEqualText: 'Does not equal',
      editTokenHeader: 'Edit filter',
      propertyText: 'Property',
      operatorText: 'Operator',
      valueText: 'Value',
      cancelActionText: 'Cancel',
      applyActionText: 'Apply',
      allPropertiesLabel: 'All properties',
      tokenLimitShowMore: 'Show more',
      tokenLimitShowFewer: 'Show fewer',
      clearFiltersText: 'Clear filters',
      removeTokenButtonAriaLabel: expect.any(Function),
      enteredTextLabel: expect.any(Function),
    });
  });

  it('removeTokenButtonAriaLabel returns the expected string', () => {
    const result = i18nStrings.removeTokenButtonAriaLabel();
    expect(result).toEqual('Remove token');
  });
});
