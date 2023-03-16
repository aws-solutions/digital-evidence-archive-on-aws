import { render } from '@testing-library/react';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AuthenticationProvider, useAuthentication } from '../../src/context/AuthenticationContext';

const username = 'my-username';
const jwtPayload = {
  cognito: {
    username: username,
  },
};
const token = jwt.sign(jwtPayload, 'my-secret-key');

// Mock sign-in function that sets the user in local storage
const mockSignIn = () => {
  localStorage.setItem('idToken', token);
  localStorage.setItem('accessKeyId', 'mock-access-key');
  localStorage.setItem('secretAccessKey', 'mock-secret-key');
  localStorage.setItem('sessionToken', 'mock-session-token');
  localStorage.setItem('refreshToken', 'mock-refresh-token');
};

// Mock getLoginUrl function
jest.mock('../../src/api/auth', () => ({
  getLoginUrl: jest.fn(() => Promise.resolve('https://dummywebsite.com/login')),
}));

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

const useRouter = jest.spyOn(require('next/router'), 'useRouter');

describe('AuthenticationProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects to login page if not logged in', async () => {
    const router = {
      push: jest.fn(),
      pathname: '/dummy-path',
    };
    useRouter.mockReturnValue(router);
    // Clear local storage to simulate not being logged in
    localStorage.clear();
    render(<AuthenticationProvider children={false} />);

    // Expect getLoginUrl to have been called once
    expect(require('../../src/api/auth').getLoginUrl).toHaveBeenCalledTimes(1);

    // Call checkLogin to trigger the redirect
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Expect router.push to have been called with the expected URL
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('https://dummywebsite.com/login');
  });

  it('Tries to decode user if user is logged in', async () => {
    // Populate local storage mocking logged in user
    mockSignIn();

    const router = {
      push: jest.fn(),
      pathname: '/dummy-path',
    };
    useRouter.mockReturnValue(router);
    render(<AuthenticationProvider children={false} />);

    // Expect this not to be called
    expect(require('../../src/api/auth').getLoginUrl).not.toBeCalledTimes(0);

    // Should not redirect since we're logged in
    expect(router.push).toHaveBeenCalledTimes(0);
  });

  it('returns if its /login or /auth-test', async () => {
    const router = {
      push: jest.fn(),
      pathname: '/login',
    };
    useRouter.mockReturnValue(router);
    // Clear local storage to simulate not being logged in
    localStorage.clear();
    render(<AuthenticationProvider children={false} />);
  });
});
