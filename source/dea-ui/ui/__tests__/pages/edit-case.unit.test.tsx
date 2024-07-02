import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useGetCaseById } from '../../src/api/cases';
import { commonLabels } from '../../src/common/labels';
import EditCasePage from '../../src/pages/edit-case';

const CASE_ID = '100';
const CASE_NAME = 'mocked case';
interface Query {
  caseId: string | object;
  caseName: string | object;
}
let query: Query = {
  caseId: CASE_ID,
  caseName: CASE_NAME,
};
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((key: keyof Query) => query[key]),
  }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('../../src/api/cases', () => ({
  useGetCaseById: jest.fn(),
  useGetCaseActions: jest.fn(),
}));

describe('EditCasePage', () => {
  it('renders a loading label during fetch', () => {
    useGetCaseById.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
    }));
    const page = render(<EditCasePage />);
    const label = screen.getByText(commonLabels.loadingLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });

  it('renders a not found text if no case found', () => {
    useGetCaseById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    const page = render(<EditCasePage />);
    const label = screen.getByText(commonLabels.notFoundLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });

  it('renders the edit form', () => {
    useGetCaseById.mockImplementation(() => ({
      data: {
        ulid: '100',
        name: CASE_NAME,
        description: 'some description',
        status: 'ACTIVE',
      },
      isLoading: false,
    }));
    const page = render(<EditCasePage />);
    expect(page).toBeTruthy();

    const nameInput = screen.getByTestId('input-name');
    const wrappedName = wrapper(nameInput).findInput();
    if (!wrappedName) {
      fail();
    }
    expect(wrappedName.findNativeInput().getElement().value).toEqual(CASE_NAME);

    const descriptionInput = screen.getByTestId('input-description');
    const wrappedDescription = wrapper(descriptionInput).findTextarea();
    if (!wrappedDescription) {
      fail();
    }
    expect(wrappedDescription.findNativeTextarea().getElement().value).toEqual('some description');

    const cancelButton = screen.getByTestId('edit-case-cancel');
    expect(cancelButton).toBeTruthy();

    const saveButton = screen.getByTestId('edit-case-submit');
    expect(saveButton).toBeTruthy();
  });

  it('renders a not found text if no caseId is provided', () => {
    query = { caseId: undefined };
    const page = render(<EditCasePage />);
    const label = screen.getByText(commonLabels.notFoundLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });
});
