import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import TestLoginPage from '../../src/pages/auth-test';

describe('LoginPage', () => {
  it('renders a login page when waiting to log in', async () => {
    const page = render(<TestLoginPage />);
    expect(page).toBeTruthy();
  });
});
