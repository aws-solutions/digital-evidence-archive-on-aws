import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useGetCaseById, useGetCaseActions } from '../../src/api/cases';
import { breadcrumbLabels, commonLabels } from '../../src/common/labels';
import CaseDetailsPage from '../../src/pages/case-detail';

let query: { caseId: string | undefined } = { caseId: '100' };
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query,
    push: jest.fn(),
  })),
}));

jest.mock('../../src/api/cases', () => ({
  useGetCaseById: jest.fn(),
  useGetCaseActions: jest.fn(),
}));

describe('CaseDetailsPage', () => {
  it('renders a blank page with no caseId', async () => {
    useGetCaseById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    const page = render(<CaseDetailsPage />);
    const anyHeader = screen.queryByRole('heading');

    expect(anyHeader).toBeTruthy();
    expect(page).toBeTruthy();

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(2);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.homePageLabel);
    expect(breadcrumbLinks[1].getElement()).toHaveTextContent('');
  });

  it('renders a loading label during fetch', () => {
    useGetCaseById.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
    }));
    const page = render(<CaseDetailsPage />);
    const label = screen.getByText(commonLabels.loadingLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });

  it('renders a not found warning if no caseId is provided', () => {
    query = { caseId: undefined };
    useGetCaseById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    const page = render(<CaseDetailsPage />);
    const anyHeader = screen.queryByRole('heading');

    expect(anyHeader).toBeTruthy();
    expect(page).toBeTruthy();
  });
});
