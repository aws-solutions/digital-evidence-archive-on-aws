/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios, { AxiosRequestConfig } from 'axios';

let urlBase = process.env.NEXT_PUBLIC_DEA_API_URL;
if (typeof window !== 'undefined' && !urlBase) {
  urlBase = `https://${window.location.hostname}/${process.env.NEXT_PUBLIC_STAGE}/`;
}

const fetchData = async <T>(options: AxiosRequestConfig): Promise<T> => {
  const accessKeyId = sessionStorage.getItem('accessKeyId');
  const secretAccessKey = sessionStorage.getItem('secretAccessKey');
  const sessionToken = sessionStorage.getItem('sessionToken');

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
  const { data } = await client.request(options).catch((error: Error) => {
    console.log(error);
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
