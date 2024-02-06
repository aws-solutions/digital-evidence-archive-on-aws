import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import Axios from 'axios';
import { commonLabels } from '../../src/common/labels';
import EditDataVaultPage from '../../src/pages/edit-data-vault';

afterEach(cleanup);

const push = jest.fn();

const DATA_VAULT_ID = '100';
const DATA_VAULT_NAME = 'mocked data vault';
interface Query {
  dataVaultId: string | object; 
  dataVaultName: string | object;
}
let query: Query = {
  dataVaultId: DATA_VAULT_ID,
  dataVaultName: DATA_VAULT_NAME,
}
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((key: keyof Query) => query[key])
  }),
  useRouter: () => ({
    push,
  })
})); 

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

describe('EditDataVaultPage page', () => {
  it('responds to cancel', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: {
        ulid: DATA_VAULT_ID,
        name: 'mocked data vault',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    render(<EditDataVaultPage />);

    const cancelButton = await screen.findByTestId('edit-data-vault-cancel');
    fireEvent.click(cancelButton);

    expect(push).toHaveBeenCalledWith(`/data-vault-detail?dataVaultId=${DATA_VAULT_ID}`);
  });

  it('responds to save button click', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: {
        ulid: DATA_VAULT_ID,
        name: 'mocked data vault',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const user = userEvent.setup();
    render(<EditDataVaultPage />);

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
    expect(push).toHaveBeenCalledWith(`/data-vault-detail?dataVaultId=${DATA_VAULT_ID}`);
  });

  it('recovers from edition failure', async () => {
    const validationMessage = 'Data vault name is already in use';
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
          ulid: DATA_VAULT_ID,
          name: 'mocked data vault',
        },
        status: 200,
        statusText: 'Ok',
        headers: {},
        config: {},
      });
    });

    const user = userEvent.setup();
    const page = render(<EditDataVaultPage />);

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
