import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useGetDataVaultById } from '../../src/api/data-vaults';
import { commonLabels } from '../../src/common/labels';
import EditDataVaultPage from '../../src/pages/edit-data-vault';

const DATA_VAULT_NAME = 'mocked data vault';
let query: { dataVaultId: string | undefined; dataVaultName: string | undefined } = {
  dataVaultId: '100',
  dataVaultName: DATA_VAULT_NAME,
};
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query,
    push: jest.fn(),
  })),
}));

jest.mock('../../src/api/data-vaults', () => ({
  useGetDataVaultById: jest.fn(),
}));

describe('EditDataVaultPage', () => {
  it('renders a loading label during fetch', () => {
    useGetDataVaultById.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
    }));
    const page = render(<EditDataVaultPage />);
    const label = screen.getByText(commonLabels.loadingLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });

  it('renders a not found text if no case found', () => {
    useGetDataVaultById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    const page = render(<EditDataVaultPage />);
    const label = screen.getByText(commonLabels.notFoundLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });

  it('renders the edit form', () => {
    useGetDataVaultById.mockImplementation(() => ({
      data: {
        ulid: '100',
        name: DATA_VAULT_NAME,
        description: 'some description',
      },
      isLoading: false,
    }));
    const page = render(<EditDataVaultPage />);
    expect(page).toBeTruthy();

    const nameInput = screen.getByTestId('input-name');
    const wrappedName = wrapper(nameInput).findInput();
    if (!wrappedName) {
      fail();
    }
    expect(wrappedName.findNativeInput().getElement().value).toEqual(DATA_VAULT_NAME);

    const descriptionInput = screen.getByTestId('input-description');
    const wrappedDescription = wrapper(descriptionInput).findTextarea();
    if (!wrappedDescription) {
      fail();
    }
    expect(wrappedDescription.findNativeTextarea().getElement().value).toEqual('some description');

    const cancelButton = screen.getByTestId('edit-data-vault-cancel');
    expect(cancelButton).toBeTruthy();

    const saveButton = screen.getByTestId('edit-data-vault-submit');
    expect(saveButton).toBeTruthy();
  });

  it('renders a not found text if no dataVaultId is provided', () => {
    query = { dataVaultId: undefined };
    const page = render(<EditDataVaultPage />);
    const label = screen.getByText(commonLabels.notFoundLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });
});
