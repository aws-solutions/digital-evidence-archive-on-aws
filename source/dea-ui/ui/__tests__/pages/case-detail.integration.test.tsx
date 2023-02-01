import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import axios from 'axios';
import { caseDetailLabels } from '../../src/common/labels';
import CaseDetailsPage from '../../src/pages/[caseId]';
import wrapper from '@cloudscape-design/components/test-utils/dom';
import { fail } from 'assert';

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { caseId: '100' },
    push: jest.fn(),
  })),
}));

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

describe('CaseDetailsPage', () => {
  it('renders a case details page', async () => {
    mockedAxios.mockResolvedValue({
      data: {
        ulid: 'abc',
        name: 'mocked case',
        status: 'ACTIVE',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const page = render(<CaseDetailsPage />);
    const mockedCaseInfo = await screen.findByText('mocked case');

    expect(page).toBeTruthy();
    expect(mockedCaseInfo).toBeTruthy();
  });

  it('navigates to audit log', async () => {
    mockedAxios.mockResolvedValue({
      data: {
        ulid: 'abc',
        name: 'mocked case',
        status: 'ACTIVE',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const tab = await screen.findByText(caseDetailLabels.auditLogLabel);
    fireEvent.click(tab);
    const auditTable = await screen.findByTestId('audit-table');
    expect(auditTable).toBeTruthy();
    expect(auditTable).toBeInTheDocument();
  });

  it('navigates to manage access page', async () => {
    mockedAxios.mockResolvedValue({
      data: {
        ulid: 'abc',
        name: 'mocked case',
        status: 'ACTIVE',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const tab = await screen.findByText(caseDetailLabels.manageAccessLabel);
    fireEvent.click(tab);
    const accessInput = await screen.findByTestId('manage-access-input');
    expect(accessInput).toBeTruthy();
    expect(accessInput).toBeInTheDocument();
    expect(accessInput.nodeValue).toEqual(null);

    const container = await screen.findByTestId('manage-access-container');
    const input = wrapper(container).findFormField()?.findControl()?.findInput();

    if (!input) {
      fail();
    }

    const newVal = 'new input value';
    input.setInputValue(newVal);
  });
});
