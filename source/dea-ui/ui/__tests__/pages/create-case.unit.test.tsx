import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event'
import { fail } from 'assert';
import axios from 'axios';
import { commonLabels, createCaseLabels } from '../../src/common/labels';
import Home from '../../src/pages/create-cases';

const push = jest.fn();

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  }))
}));

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

describe('CreateCases page', () => {
  it('renders a case creation page', async () => {
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

    const user = userEvent.setup();
    const page = render(<Home/>);
    const createCaseLabel = screen.getByText(createCaseLabels.createNewCaseLabel);

    expect(page).toBeTruthy();
    expect(createCaseLabel).toBeTruthy();

    const button = screen.getByRole('button', {name: commonLabels.createButton});
    await user.click(button);

    const shareFormContainer = await screen.findByTestId('share-form-container');
    const autoSuggest = wrapper(shareFormContainer).findAutosuggest();
    if (!autoSuggest) {
      fail();
    }
    autoSuggest.setInputValue('suggest');
  });

  it('responds to cancel', () => {
    render(<Home/>);

    const cancelButton = screen.getByTestId('create-case-cancel');

    const btn = wrapper(cancelButton);
    btn.click();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('responds to form submit', () => {
    render(<Home/>);

    const nameInput = screen.getByTestId('input-name');
    const wrappedName = wrapper(nameInput).findInput();
    if (!wrappedName) {
      fail();
    }
    wrappedName.setInputValue("a name");

    const descriptionInput = screen.getByTestId('input-description');
    const wrappedDescription = wrapper(descriptionInput).findTextarea();
    if (!wrappedDescription) {
      fail();
    }
    wrappedDescription.setTextareaValue("a description");

    const form = screen.getByTestId('create-case-form');
    fireEvent.submit(form);
  });
});