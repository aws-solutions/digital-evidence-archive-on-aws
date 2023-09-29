import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import Axios from 'axios';
import { breadcrumbLabels, commonLabels, createDataVaultLabels } from '../../src/common/labels';
import Home from '../../src/pages/create-data-vaults';

const push = jest.fn();

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  })),
}));

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

describe('CreateDataVaults page', () => {
  it('responds to cancel', () => {
    render(<Home />);

    const cancelButton = screen.getByTestId('create-data-vault-cancel');

    const btn = wrapper(cancelButton);
    btn.click();
    expect(push).toHaveBeenCalledWith('/data-vaults');
  });

  it('responds to form submit', () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: {
        ulid: 'abc',
        name: 'mocked data vault',
        description: 'some description',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    render(<Home />);

    const nameInput = screen.getByTestId('input-name');
    const wrappedName = wrapper(nameInput).findInput();
    if (!wrappedName) {
      fail();
    }
    wrappedName.setInputValue('a name');

    const descriptionInput = screen.getByTestId('input-description');
    const wrappedDescription = wrapper(descriptionInput).findTextarea();
    if (!wrappedDescription) {
      fail();
    }
    wrappedDescription.setTextareaValue('a description');

    const form = screen.getByTestId('create-data-vault-form');
    fireEvent.submit(form);
    expect(push).toHaveBeenCalledWith('/data-vaults');
  });

  it('responds to create button click', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: {
        ulid: 'abc',
        name: 'mocked data vault',
        description: 'some description',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const user = userEvent.setup();
    render(<Home />);

    const nameInput = screen.getByTestId('input-name');
    const wrappedName = wrapper(nameInput).findInput();
    if (!wrappedName) {
      fail();
    }
    wrappedName.setInputValue('a name');

    const descriptionInput = screen.getByTestId('input-description');
    const wrappedDescription = wrapper(descriptionInput).findTextarea();
    if (!wrappedDescription) {
      fail();
    }
    wrappedDescription.setTextareaValue('a description');

    const button = screen.getByRole('button', { name: commonLabels.createButton });
    await user.click(button);
    expect(push).toHaveBeenCalledWith('/data-vault-detail?dataVaultId=abc');
  });

  it('recovers from creation failure', async () => {
    const dataVaultName = 'mocked data vault';
    const validationMessage = `Data vault with name "${dataVaultName}" is already in use`;
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockRejectedValue({
      data: validationMessage,
      status: 400,
      statusText: '',
      headers: {},
      config: {},
    });

    const user = userEvent.setup();
    const page = render(<Home />);
    const headerWrapper = wrapper(page.container).findHeader();
    expect(page).toBeTruthy();
    expect(headerWrapper).toBeTruthy();
    expect(headerWrapper?.findHeadingText().getElement()).toHaveTextContent(
      createDataVaultLabels.createNewDataVaultLabel
    );

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(2);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.dataVaultsLabel);
    expect(breadcrumbLinks[1].getElement()).toHaveTextContent(breadcrumbLabels.createNewDataVaultLabel);

    const nameInput = screen.getByTestId('input-name');
    const wrappedName = wrapper(nameInput).findInput();
    if (!wrappedName) {
      fail();
    }
    wrappedName.setInputValue(dataVaultName);

    const button = screen.getByRole('button', { name: commonLabels.createButton });
    await user.click(button);

    // error notification is visible
    const notificationsWrapper = wrapper(page.container).findFlashbar()!;
    expect(notificationsWrapper).toBeTruthy();
  });
});
