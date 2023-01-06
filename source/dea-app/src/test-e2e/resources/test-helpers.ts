/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios from 'axios';

export async function deleteCase(
  baseUrl: string,
  caseUlid: string,
  creds: Credentials,
  region: string
): Promise<void> {
  const client = axios.create();

  const interceptor = aws4Interceptor(
    {
      service: 'execute-api',
      region: region,
    },
    creds
  );

  client.interceptors.request.use(interceptor);
  const response = await client.delete(`${baseUrl}cases/${caseUlid}`);

  expect(response.status).toBeTruthy();
}
