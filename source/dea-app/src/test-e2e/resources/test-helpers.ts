/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios from 'axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { caseResponseSchema } from '../../models/validation/case';
import { envSettings } from '../helpers/settings';

// we don't want axios throwing an exception on non 200 codes
export const validateStatus = () => true;

export async function deleteCase(baseUrl: string, caseUlid: string, creds: Credentials): Promise<void> {
  const client = axios.create();

  const interceptor = aws4Interceptor(
    {
      service: 'execute-api',
      region: envSettings.awsRegion,
    },
    creds
  );

  client.interceptors.request.use(interceptor);
  const response = await client.delete(`${baseUrl}cases/${caseUlid}`, {
    validateStatus,
  });

  expect(response.status).toEqual(204);
}

export async function createCaseSuccess(
  baseUrl: string,
  deaCase: DeaCase,
  creds: Credentials
): Promise<DeaCase> {
  const client = axios.create();

  const interceptor = aws4Interceptor(
    {
      service: 'execute-api',
      region: envSettings.awsRegion,
    },
    creds
  );

  client.interceptors.request.use(interceptor);

  const response = await client.post(
    `${baseUrl}cases`,
    {
      name: deaCase.name,
      status: deaCase.status,
      description: deaCase.description,
    },
    {
      validateStatus,
    }
  );

  if (response.status !== 200) {
    console.log(response.data);
  }
  expect(response.status).toEqual(200);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const createdCase = response.data as DeaCase;
  Joi.assert(createdCase, caseResponseSchema);
  expect(createdCase.name).toEqual(deaCase.name);
  return createdCase;
}
