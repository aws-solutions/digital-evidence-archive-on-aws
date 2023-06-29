import axios from 'axios';
import {
  Credentials,
  getCallbackUrl,
  getCredentialsByToken,
  refreshCredentials,
  signOutProcess,
} from '../../src/helpers/authService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockCredentials: Credentials = {
  AccessKeyId: 'dummyAccessKeyId',
  SecretKey: 'dummyAecretAccessKey',
  SessionToken: 'dummySessionToken',
};

const mockTokenData = {
  idToken: 'mock-id-token',
  identityPoolId: 'us-east-1:01234567-abcd-cdef-0123-123456789abc', // fake identity pool id that satisfies JOI validation
  userPoolId: 'us-east-1_dummy-user-pool-id',
};

jest.mock('@aws-sdk/client-cognito-identity', () => {
  return {
    CognitoIdentityClient: jest.fn(() => ({
      send: jest.fn(() => {
        return Promise.resolve({
          IdentityId: 'dummyIdentityId',
          Credentials: mockCredentials,
        });
      }),
    })),
    GetCredentialsForIdentityCommand: jest.fn(),
    GetIdCommand: jest.fn(),
  };
});

describe('auth service', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('Returns correct callback url', () => {
    const mockWindowLocation = new URL('https://dea.com/devsample/ui/');
    global.window = Object.create(window);
    Object.defineProperty(window, 'location', {
      value: mockWindowLocation,
      writable: true,
    });

    const url = getCallbackUrl();
    expect(url).toEqual('https://dea.com/devsample/ui/login');
  });

  it('Get credentials given id token', async () => {
    const creds = await getCredentialsByToken(
      mockTokenData.idToken,
      mockTokenData.identityPoolId,
      mockTokenData.userPoolId
    );

    expect(creds).toEqual(mockCredentials);
  });

  it('refreshes credentials and populates session storage', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: mockTokenData,
    });

    await refreshCredentials();
    expect(sessionStorage.getItem('accessKeyId')).toEqual(mockCredentials.AccessKeyId);
    expect(sessionStorage.getItem('secretAccessKey')).toEqual(mockCredentials.SecretKey);
    expect(sessionStorage.getItem('sessionToken')).toEqual(mockCredentials.SessionToken);
  });

  it('should clear session storage', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: 'loginUrl',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const url = await signOutProcess();

    expect(sessionStorage.removeItem('accessKeyId')).toEqual(undefined);
    expect(sessionStorage.removeItem('secretAccessKey')).toEqual(undefined);
    expect(sessionStorage.removeItem('sessionToken')).toEqual(undefined);
    expect(sessionStorage.removeItem('pkceVerifier')).toEqual(undefined);

    expect(url).toEqual('loginUrl');
  });
});
