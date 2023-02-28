import axios from 'axios';
import * as apiHelper from '../../src/helpers/apiHelper';

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

describe('api helper', () => {
  it('catches errors', async () => {
    mockedAxios.mockRejectedValue('error');

    await expect(apiHelper.httpApiGet('any', {})).rejects.toThrow(
      'there was an error while trying to retrieve data'
    );
  });

  it('makes a get request', async () => {
    mockedAxios.mockResolvedValue({
      data: 'hi',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const response = await apiHelper.httpApiGet('any', {});
    expect(response).toEqual('hi');
  });

  it('makes a put request', async () => {
    mockedAxios.mockResolvedValue({
      data: 'hi',
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const response = await apiHelper.httpApiPut('any', {});
    expect(response).toEqual('hi');
  });

  it('makes a delete request', async () => {
    mockedAxios.mockResolvedValue({
      data: {},
      status: 204,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    await apiHelper.httpApiDelete('any', {});
  });
});
