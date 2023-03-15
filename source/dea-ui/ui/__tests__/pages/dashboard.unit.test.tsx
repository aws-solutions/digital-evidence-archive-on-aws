import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { fail } from 'assert';
import axios from 'axios';
import { caseListLabels } from '../../src/common/labels';
import Home from '../../src/pages';

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;
const push = jest.fn();

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  })),
}));

describe('Dashboard', () => {
  it('renders a list of cases', async () => {
    mockedAxios.mockResolvedValue({
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
    const page = render(<Home />);
    const listItem = await screen.findByText('mocked case');

    expect(page).toBeTruthy();
    expect(listItem).toBeTruthy();
  });

  it('navigates to create a new case', async () => {
    mockedAxios.mockResolvedValue({
      data: {
        cases: [],
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
    render(<Home />);

    const createCaseButton = await screen.findByText(caseListLabels.createNewCaseLabel);
    fireEvent.click(createCaseButton);
    expect(push).toHaveBeenCalledWith('/create-cases');
  });

  it('navigates to create case details', async () => {
    mockedAxios.mockResolvedValue({
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
});
