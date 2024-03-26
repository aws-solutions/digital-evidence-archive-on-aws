import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { commonLabels } from '../../src/common/labels';
import LoginPage from '../../src/pages/login';

interface Query {
  code: string;
}
let query: Query = {
  code: 'abcdefg',
};
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((key: keyof Query) => query[key]),
  }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

describe('LoginPage', () => {
  it('renders a login page when waiting to log in', async () => {
    const page = render(<LoginPage />);
    const loginLabel = screen.getByText(commonLabels.loginLabel);
    expect(page).toBeTruthy();
    expect(loginLabel).toBeTruthy();
  });
});
