/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios, { AxiosRequestConfig } from 'axios';

let urlBase = '';
if (typeof window !== 'undefined') {
  urlBase = `https://${window.location.hostname}`;
}

// TODO: Use generics instead of using any for methods here

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchData = async (options: AxiosRequestConfig): Promise<any> => {
  const accessKeyId = localStorage.getItem('accessKeyId');
  const secretAccessKey = localStorage.getItem('secretAccessKey');
  const sessionToken = localStorage.getItem('sessionToken');
  const idToken = localStorage.getItem('idToken');

  options.headers = {
    ...options.headers,
    authorization: 'allow',
  };

  if (idToken && accessKeyId && secretAccessKey && sessionToken) {
    const client = axios.create();
    // create credentials
    const credentials: Credentials = {
      accessKeyId,
      secretAccessKey,
      sessionToken,
    };

    options.headers = {
      ...options.headers,
      idToken: idToken,
    };

    const interceptor = aws4Interceptor(
      {
        service: 'execute-api',
      },
      credentials
    );

    client.interceptors.request.use(interceptor);
    const { data } = await client.request(options).catch((error: Error) => {
      console.log(error);
      // TODO: call logger to capture exception
      throw new Error('there was an error while trying to retrieve data');
    });

    return data;
  } else {
    const { data } = await axios(options).catch(function (error: Error) {
      console.log(error);
      // TODO: call logger to capture exception
      throw new Error('there was an error while trying to retrieve data');
    });

    return data;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpApiGet = async (urlPath: string, params: any): Promise<any> => {
  const options = {
    method: 'GET',
    url: `${urlBase}${urlPath}`,
    data: params,
  };
  return await fetchData(options);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpApiPost = async (urlPath: string, params: any): Promise<any> => {
  const options = {
    method: 'POST',
    url: `${urlBase}${urlPath}`,
    data: params,
  };
  return await fetchData(options);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpApiPut = async (urlPath: string, params: any): Promise<any> => {
  const options = {
    method: 'PUT',
    url: `${urlBase}${urlPath}`,
    data: params,
  };
  return await fetchData(options);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpApiDelete = async (urlPath: string, params: any): Promise<any> => {
  const options = {
    method: 'DELETE',
    url: `${urlBase}${urlPath}`,
    data: params,
  };
  return await fetchData(options);
};

export { httpApiGet, httpApiPost, httpApiPut, httpApiDelete };
