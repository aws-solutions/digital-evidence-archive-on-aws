import '@testing-library/jest-dom';
import axios from 'axios';
import { getCredentials, getToken, getLoginUrl, getLogoutUrl, revokeToken } from '../../src/api/auth';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('auth helper', () => {
  it('should return token', async () => {
    // id token mock
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: '123456',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
    const dummyToken = await getToken('DUMMYAUTHCODE');
    expect(dummyToken).toEqual('123456');
  });

  it('should fail to return token', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockRejectedValue({
      response: {
        data: {},
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {},
      },
    });
    await expect(getToken('badAuthCode')).rejects.toThrow('there was an error while trying to retrieve data');
  });

  it('should return credentials', async () => {
    const expectedData = { AccessKeyId: 100, SecretKey: 'secret', SessionToken: 'abc' };
    // id token mock
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
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

  it('should fail to return creds', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockRejectedValue({
      response: {
        data: {},
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {},
      },
    });
    await expect(getCredentials('badIdToken')).rejects.toThrow(
      'there was an error while trying to retrieve data'
    );
  });

  it('should return login Url', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: 'dummyloginurl.com',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
    const loginUrl = await getLoginUrl();
    expect(loginUrl).toEqual('dummyloginurl.com');
  });

  it('should fail to login Url', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockRejectedValue({
      response: {
        data: {},
        status: 500,
        statusText: 'Bad Request',
        headers: {},
        config: {},
      },
    });
    await expect(getLoginUrl()).rejects.toThrow('there was an error while trying to retrieve data');
  });

  it('should return logout Url', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: 'dummylogouturl.com',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
    const logoutUrl = await getLogoutUrl();
    expect(logoutUrl).toEqual('dummylogouturl.com');
  });

  it('should fail to logout Url', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockRejectedValue({
      response: {
        data: {},
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: {},
      },
    });
    await expect(getLogoutUrl()).rejects.toThrow('there was an error while trying to retrieve data');
  });

  it('should revoke successfully', async () => {
    // id token mock
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: '123456',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });
    await expect(revokeToken('DUMMYREFRESHTOKEN')).toBeTruthy();
  });
});
