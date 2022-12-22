/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import fetch from 'node-fetch';
import { DeaCase } from '../../models/case';
import { caseSchema } from '../../models/validation/case';

describe('create cases api', () => {
  let deaApiUrl: string | undefined;
  beforeAll(() => {
    deaApiUrl = process.env.DEA_API_URL;
  });

  it('should create a new case', async () => {
    const caseName = 'CASE B';
    const url = `${deaApiUrl}cases`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: 'allow',
      },
      body: JSON.stringify({
        name: caseName,
        status: 'ACTIVE',
        description: 'this is a description',
      }),
    });

    expect(response.ok).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const jsonResp = (await response.json()) as DeaCase;
    Joi.assert(jsonResp, caseSchema);

    expect(jsonResp.name).toEqual(caseName);
    await deleteCase(deaApiUrl ?? fail(), jsonResp.ulid ?? fail());
  }, 10000);

  it('should give an error when payload is missing', async () => {
    const response = await fetch(`${deaApiUrl}cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        authorization: 'allow',
      },
      body: undefined,
    });

    expect(response.ok).toBeFalsy();
    expect(response.status).toEqual(400);
    expect(await response.text()).toEqual('Create cases payload missing.');
  });

  it('should give an error when the name is in use', async () => {
    const caseName = 'CASE C';
    const response = await fetch(`${deaApiUrl}cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        authorization: 'allow',
      },
      body: JSON.stringify({
        name: caseName,
        status: 'ACTIVE',
        description: 'any description',
      }),
    });

    expect(response.ok).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const jsonResp = (await response.json()) as DeaCase;
    Joi.assert(jsonResp, caseSchema);

    const response2 = await fetch(`${deaApiUrl}cases`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json;charset=UTF-8',
        authorization: 'allow',
      },
      body: JSON.stringify({
        name: caseName,
        status: 'ACTIVE',
        description: 'any description',
      }),
    });

    expect(response2.ok).toBeFalsy();
    expect(response2.status).toEqual(500);

    await deleteCase(deaApiUrl ?? fail(), jsonResp.ulid ?? fail());
  }, 10000);
});

async function deleteCase(baseUrl: string, caseUlid: string): Promise<void> {
  const response = await fetch(`${baseUrl}cases/${caseUlid}`, {
    method: 'DELETE',
    headers: {
      authorization: 'allow',
    },
  });

  expect(response.ok).toBeTruthy();
}
