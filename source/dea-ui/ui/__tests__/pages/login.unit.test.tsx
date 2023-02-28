import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { commonLabels } from '../../src/common/labels';
import LoginPage from '../../src/pages/login';

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { code: 'abcdefg' },
    push: jest.fn(),
  })),
}));

describe('LoginPage', () => {
  it('renders a login page when waiting to log in', async () => {
    const page = render(<LoginPage />);
    const loginLabel = screen.getByText(commonLabels.loginLabel);
    expect(page).toBeTruthy();
    expect(loginLabel).toBeTruthy();
  });
});
