import wrapper from '@cloudscape-design/components/test-utils/dom';
import createWrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fail } from 'assert';
import axios from 'axios';
import { breadcrumbLabels, caseListLabels, commonLabels } from '../../src/common/labels';
import { i18nStringsForPropertyFilter } from '../../src/components/common-components/commonDefinitions';
import Home from '../../src/pages';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const push = jest.fn();

jest.mock('next/navigation', () => ({
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
            endpoints: ['/casesPOST', '/cases/{caseId}/statusPUT'],
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
                actions: ['UPDATE_CASE_STATUS'],
              },
              {
                ulid: 'def',
                name: 'case2',
                status: 'INACTIVE',
                actions: ['UPDATE_CASE_STATUS'],
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
    expect(i18nStringsForPropertyFilter).toEqual({
      filteringAriaLabel: 'Search',
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
      clearAriaLabel: 'Clear field',
      removeTokenButtonAriaLabel: expect.any(Function),
      enteredTextLabel: expect.any(Function),
    });
  });

  it('removeTokenButtonAriaLabel returns the expected string', () => {
    const result = i18nStringsForPropertyFilter.removeTokenButtonAriaLabel();
    expect(result).toEqual('Remove token');
  });

  it('can deactivate a case', async () => {
    const page = render(<Home />);
    const pageWrapper = wrapper(page.baseElement);
    expect(page).toBeTruthy();
    expect(pageWrapper).toBeTruthy();

    const tableWrapper = pageWrapper.findTable();
    if (!tableWrapper) fail();
    expect(tableWrapper.findRows().length).toEqual(2);

    const deactivateButton = screen.queryByTestId('deactivate-button');
    if (!deactivateButton) fail();
    expect(deactivateButton).toBeDisabled();

    const activeCaseSelection = tableWrapper.findRowSelectionArea(1);
    expect(activeCaseSelection).toBeTruthy();
    await act(async () => {
      activeCaseSelection!.click();
    });

    expect(tableWrapper.findSelectedRows().length).toEqual(1);

    await waitFor(() => expect(screen.queryByTestId('deactivate-button')).toBeEnabled());
    fireEvent.click(deactivateButton);

    await waitFor(() => expect(screen.queryByTestId('deactivate-modal')).toBeVisible());
    const deactivateButtonInModal = screen.queryByTestId('submit-deactivate');
    if (!deactivateButtonInModal) fail();
    fireEvent.click(deactivateButtonInModal);

    await waitFor(() => expect(screen.queryByTestId('deactivate-button')).toBeDisabled());
  });

  it('can activate a case', async () => {
    const page = render(<Home />);
    const pageWrapper = wrapper(page.baseElement);
    expect(page).toBeTruthy();
    expect(pageWrapper).toBeTruthy();

    const tableWrapper = pageWrapper.findTable();
    if (!tableWrapper) fail();
    expect(tableWrapper!.findRows().length).toEqual(2);

    const activateButton = screen.queryByTestId('activate-button');
    if (!activateButton) fail();
    expect(activateButton).toBeDisabled();

    const inactiveCaseSelection = tableWrapper.findRowSelectionArea(2);
    expect(inactiveCaseSelection).toBeTruthy();
    await act(async () => {
      inactiveCaseSelection!.click();
    });

    expect(tableWrapper.findSelectedRows().length).toEqual(1);

    await waitFor(() => expect(screen.queryByTestId('activate-button')).toBeEnabled());
    fireEvent.click(activateButton);

    // wait for modal to be visible
    await waitFor(() => expect(screen.queryByTestId('activate-modal')).toBeVisible());
    const activateButtonInModal = screen.queryByText(commonLabels.activateButton);
    if (!activateButtonInModal) fail();
    fireEvent.click(activateButtonInModal);

    await waitFor(() => expect(screen.queryByTestId('activate-button')).toBeDisabled());
  });
});
