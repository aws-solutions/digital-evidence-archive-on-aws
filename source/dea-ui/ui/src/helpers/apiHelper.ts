/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { refreshCredentials, signOutProcess } from './authService';

let urlBase = process.env.NEXT_PUBLIC_DEA_API_URL;
if (typeof window !== 'undefined' && !urlBase) {
  urlBase = `https://${window.location.hostname}/${process.env.NEXT_PUBLIC_STAGE}/`;
}

const fetchData = async <T>(options: AxiosRequestConfig): Promise<T> => {
  const accessKeyId = sessionStorage.getItem('accessKeyId');
  const secretAccessKey = sessionStorage.getItem('secretAccessKey');
  const sessionToken = sessionStorage.getItem('sessionToken');

  // Get date/expiration and check if we need update id token
  if (!options.url?.includes('/auth')) {
    const dateString = sessionStorage.getItem('tokenExpirationTime');
    if (dateString) {
      const dateNum = parseFloat(dateString);
      const currentTime = new Date().getTime();
      if (currentTime >= dateNum) {
        await refreshCredentials();
      }
    }
  }

  options.headers = {
    ...options.headers,
  };
  const client = axios.create({ withCredentials: true });

  if (accessKeyId && secretAccessKey && sessionToken) {
    // create credentials
    const credentials: Credentials = {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    };
    const interceptor = aws4Interceptor(
      {
        service: 'execute-api',
      },
      credentials
    );

    client.interceptors.request.use(interceptor);
  }
  const { data } = await client.request(options).catch(async (error: Error) => {
    console.log(error);

    let statusCode;
    let endpointUrl;
    if (error instanceof AxiosError) {
      statusCode = error.response && error.response.status ? error.response.status : 0;
      endpointUrl = error.response && error.config.url ? error.config.url : '';

      // Logout if refresh failed (refresh token expired)
      // Logout if 412 (session lock)
      if (endpointUrl.includes('auth/refreshToken') || statusCode === 412) {
        const logoutUrl = await signOutProcess();
        window.location.assign(logoutUrl);
      }

      if (error instanceof AxiosError && error.code === 'ERR_BAD_REQUEST') {
        console.log(error.response?.data);
        throw new Error(error.response?.data);
      }
    }
    // TODO: call logger to capture exception
    throw new Error('there was an error while trying to retrieve data');
  });
  return data;
};

const httpApiGet = async <T>(urlPath: string, params: unknown): Promise<T> => {
  const options = {
    method: 'GET',
    url: `${urlBase}${urlPath}`,
    data: params,
  };
  return await fetchData(options);
};

const httpApiPost = async <T>(urlPath: string, params: unknown): Promise<T> => {
  const options = {
    method: 'POST',
    url: `${urlBase}${urlPath}`,
    data: params,
  };
  return await fetchData(options);
};

const httpApiPut = async <T>(urlPath: string, params: unknown): Promise<T> => {
  const options = {
    method: 'PUT',
    url: `${urlBase}${urlPath}`,
    data: params,
  };
  return await fetchData(options);
};

const httpApiDelete = async <T>(urlPath: string, params: unknown): Promise<T> => {
  const options = {
    method: 'DELETE',
    url: `${urlBase}${urlPath}`,
    data: params,
  };
  return await fetchData(options);
};

export { httpApiGet, httpApiPost, httpApiPut, httpApiDelete };
