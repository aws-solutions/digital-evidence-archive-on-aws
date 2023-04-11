import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fail } from 'assert';
import axios from 'axios';
import { breadcrumbLabels, commonLabels, createCaseLabels } from '../../src/common/labels';
import Home from '../../src/pages/create-cases';

const push = jest.fn();

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  })),
}));

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CreateCases page', () => {
  it('renders a case creation page', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
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
    const page = render(<Home />);
    const headerWrapper = wrapper(page.container).findHeader();
    expect(page).toBeTruthy();
    expect(headerWrapper).toBeTruthy();
    expect(headerWrapper?.findHeadingText().getElement()).toHaveTextContent(
      createCaseLabels.createNewCaseLabel
    );

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(2);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.homePageLabel);
    expect(breadcrumbLinks[1].getElement()).toHaveTextContent(breadcrumbLabels.createNewCaseLabel);

    const button = screen.getByRole('button', { name: commonLabels.createButton });
    await user.click(button);
  });

  it('responds to cancel', () => {
    render(<Home />);

    const cancelButton = screen.getByTestId('create-case-cancel');

    const btn = wrapper(cancelButton);
    btn.click();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('responds to form submit', () => {
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

    const form = screen.getByTestId('create-case-form');
    fireEvent.submit(form);
  });
});
