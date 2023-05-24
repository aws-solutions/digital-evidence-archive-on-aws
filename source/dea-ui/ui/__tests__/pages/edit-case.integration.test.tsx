import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import Axios from 'axios';
import { commonLabels } from '../../src/common/labels';
import EditCasePage from '../../src/pages/edit-case';

afterEach(cleanup);

const push = jest.fn();
const CASE_ID = '100';
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { caseId: CASE_ID },
    push,
  })),
}));

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

describe('EditCase page', () => {
  it('responds to cancel', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: {
        ulid: CASE_ID,
        name: 'mocked case',
        status: 'ACTIVE',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    render(<EditCasePage />);

    const cancelButton = await screen.findByTestId('edit-case-cancel');
    fireEvent.click(cancelButton);

    expect(push).toHaveBeenCalledWith(`/case-detail?caseId=${CASE_ID}`);
  });

  it('responds to save button click', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: {
        ulid: CASE_ID,
        name: 'mocked case',
        status: 'ACTIVE',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const user = userEvent.setup();
    render(<EditCasePage />);

    const nameInput = await screen.findByTestId('input-name');
    const wrappedName = wrapper(nameInput).findInput();
    if (!wrappedName) {
      fail();
    }
    wrappedName.setInputValue('a name');

    const descriptionInput = await screen.findByTestId('input-description');
    const wrappedDescription = wrapper(descriptionInput).findTextarea();
    if (!wrappedDescription) {
      fail();
    }
    wrappedDescription.setTextareaValue('a description');

    const button = await screen.findByRole('button', { name: commonLabels.saveButton });
    await user.click(button);
    expect(push).toHaveBeenCalledWith(`/case-detail?caseId=${CASE_ID}`);
  });

  it('recovers from edition failure', async () => {
    const validationMessage = 'Case name is already in use';
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.method === 'PUT') {
        return Promise.reject({
          data: validationMessage,
          status: 400,
          statusText: '',
          headers: {},
          config: {},
        });
      }
      return Promise.resolve({
        data: {
          ulid: CASE_ID,
          name: 'mocked case',
          status: 'ACTIVE',
        },
        status: 200,
        statusText: 'Ok',
        headers: {},
        config: {},
      });
    });

    const user = userEvent.setup();
    const page = render(<EditCasePage />);

    const nameInput = await screen.findByTestId('input-name');
    const wrappedName = wrapper(nameInput).findInput();
    if (!wrappedName) {
      fail();
    }
    wrappedName.setInputValue('a name');

    const descriptionInput = await screen.findByTestId('input-description');
    const wrappedDescription = wrapper(descriptionInput).findTextarea();
    if (!wrappedDescription) {
      fail();
    }
    wrappedDescription.setTextareaValue('a description');

    const button = await screen.findByRole('button', { name: commonLabels.saveButton });
    await user.click(button);

    // error notification is visible
    const notificationsWrapper = wrapper(page.container).findFlashbar()!;
    expect(notificationsWrapper).toBeTruthy();
  });
});
