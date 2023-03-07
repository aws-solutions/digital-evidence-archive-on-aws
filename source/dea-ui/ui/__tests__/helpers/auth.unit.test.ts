import '@testing-library/jest-dom';
import axios from 'axios';
import { getCredentials, getToken, getLoginUrl } from '../../src/api/auth';

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

describe('auth helper', () => {
  it('should return token', async () => {
    // id token mock
    mockedAxios.mockResolvedValue({
      data: '123456',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
    const dummyToken = await getToken('DUMMYAUTHCODE');
    expect(dummyToken).toEqual('123456');
  });

  it('should return credentials', async () => {
    const expectedData = { AccessKeyId: 100, SecretKey: 'secret', SessionToken: 'abc' };
    // id token mock
    mockedAxios.mockResolvedValue({
      data: {
        AccessKeyId: 100,
        SecretKey: 'secret',
        SessionToken: 'abc',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const credentials = await getCredentials('123456');
    expect(credentials).toEqual(expectedData);
  });

  it('should return login Url', async () => {
    // id token mock
    mockedAxios.mockResolvedValue({
      data: 'dummyloginurl.com',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
    const loginUrl = await getLoginUrl();
    expect(loginUrl).toEqual('dummyloginurl.com');
  });
});
