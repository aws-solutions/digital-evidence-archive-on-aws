import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import { commonLabels } from '../../src/common/labels';
import LoginPage from '../../src/pages/login';

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { code: 'abcdefg' },
    push: jest.fn(),
  })),
}));

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

describe('LoginPage', () => {
  it('renders a login page when waiting to log in', async () => {
    const responses = [
      {
        data: '123456',
        status: 200,
        statusText: 'Ok',
        headers: {},
        config: {},
      },
      {
        data: {
          AccessKeyId: 100,
          SecretKey: 'secret',
          SessionToken: 'abc',
        },
        status: 200,
        statusText: 'Ok',
        headers: {},
        config: {},
      },
    ];

    // mock the responses using mockResolvedValueOnce
    mockedAxios.mockResolvedValueOnce(responses[0]).mockResolvedValueOnce(responses[1]);

    const page = render(<LoginPage />);
    const loginLabel = screen.getByText(commonLabels.loginLabel);
    expect(page).toBeTruthy();
    expect(loginLabel).toBeTruthy();
  });
});
