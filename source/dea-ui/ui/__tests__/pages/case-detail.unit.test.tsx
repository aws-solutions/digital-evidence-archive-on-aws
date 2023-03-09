import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useGetCaseById } from '../../src/api/cases';
import { commonLabels } from '../../src/common/labels';
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
}));

describe('CaseDetailsPage', () => {
  it('renders a blank page with no caseId', async () => {
    useGetCaseById.mockImplementation(() => ({
      caseDetail: undefined,
      areCasesLoading: false,
    }));
    const page = render(<CaseDetailsPage />);
    const anyHeader = screen.queryByRole('heading');

    expect(anyHeader).toBeTruthy();
    expect(page).toBeTruthy();
  });

  it('renders a loading label during fetch', () => {
    useGetCaseById.mockImplementation(() => ({
      caseDetail: undefined,
      areCasesLoading: true,
    }));
    const page = render(<CaseDetailsPage />);
    const label = screen.getByText(commonLabels.loadingLabel);

    expect(page).toBeTruthy();
    expect(label).toBeTruthy();
  });

  it('renders a not found warning if no caseId is provided', () => {
    query = { caseId: undefined };
    useGetCaseById.mockImplementation(() => ({
      caseDetail: undefined,
      areCasesLoading: false,
    }));
    const page = render(<CaseDetailsPage />);
    const anyHeader = screen.queryByRole('heading');

    expect(anyHeader).toBeTruthy();
    expect(page).toBeTruthy();
  });
});
