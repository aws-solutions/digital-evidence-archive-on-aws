import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useGetFileDetailsById, useGetCaseActions } from '../../src/api/cases';
import { breadcrumbLabels, commonLabels } from '../../src/common/labels';
import FileDetailPage from '../../src/pages/file-detail';

interface Query {
  caseId: string | object; 
  fileId: string | object; 
}
let query: Query = {
  caseId: '100',
  fileId: '200',
}
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((key: keyof Query) => query[key])
  }),
  useRouter: () => ({
    push: jest.fn(),
  })
})); 

jest.mock('../../src/api/cases', () => ({
  useGetFileDetailsById: jest.fn(),
  useGetCaseActions: jest.fn(),
}));

describe('CaseDetailsPage', () => {
  it('renders a blank page with no caseId', async () => {
    useGetFileDetailsById.mockImplementation(() => ({
      data: undefined,
      isLoading: false,
    }));
    render(<FileDetailPage />);
    await screen.findByText(commonLabels.notFoundLabel);
  });

  it('renders a loading label during fetch', () => {
    useGetFileDetailsById.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
    }));
    render(<FileDetailPage />);
    screen.findByText(commonLabels.loadingLabel);
  });

  it('renders a not found warning if no caseId is provided', () => {
    query = { caseId: undefined, fileId: '200' };
    const page = render(<FileDetailPage />);
    render(<FileDetailPage />);
    screen.findByText(commonLabels.notFoundLabel);
  });

  it('renders a not found warning if no fileId is provided', () => {
    query = { caseId: '100', fileId: undefined };
    render(<FileDetailPage />);
    screen.findByText(commonLabels.notFoundLabel);
  });

  it('renders a not found warning if caseId is not a string', () => {
    query = { caseId: {}, fileId: '200' };
    const page = render(<FileDetailPage />);
    render(<FileDetailPage />);
    screen.findByText(commonLabels.notFoundLabel);
  });

  it('renders a not found warning if fileId is not a string', () => {
    query = { caseId: '100', fileId: {} };
    render(<FileDetailPage />);
    screen.findByText(commonLabels.notFoundLabel);
  });
});
