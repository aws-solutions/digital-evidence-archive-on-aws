/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios from 'axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { caseResponseSchema } from '../../models/validation/case';
import CognitoHelper from '../helpers/cognito-helper';
import { envSettings } from '../helpers/settings';

// we don't want axios throwing an exception on non 200 codes
export const validateStatus = () => true;

export async function deleteCase(baseUrl: string, caseUlid: string, idToken: string, creds: Credentials): Promise<void> {
  const response = await callDeaAPIWithCreds(`${baseUrl}cases/${caseUlid}`, "DELETE", idToken, creds);
  
  expect(response.status).toEqual(204);
}

export async function createCaseSuccess(
  baseUrl: string,
  deaCase: DeaCase,
  idToken: string,
  creds: Credentials
): Promise<DeaCase> {
  const response = await callDeaAPIWithCreds(`${baseUrl}cases`, "POST", idToken, creds, {
    name: deaCase.name,
    status: deaCase.status,
    description: deaCase.description,
  });

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

export async function callDeaAPI(testUser: string, url:string, cognitoHelper: CognitoHelper,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  method: string, data?: any) {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
    return await callDeaAPIWithCreds(url, method, idToken, creds, data);
}

export async function callDeaAPIWithCreds(url:string, method: string, idToken: string,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
                                          creds: Credentials, data?: any) {
  const client = axios.create({
    headers: {
      "idToken": idToken,
    }
  });

  const interceptor = aws4Interceptor(
    {
      service: 'execute-api',
      region: envSettings.awsRegion,
    },
    creds
  );

  client.interceptors.request.use(interceptor);

  client.defaults.headers.common["idToken"] = idToken;

  switch (method) {
    case "GET":
      return await client.get(url, {
        validateStatus,
      });
    case "POST":
      return await client.post(url, data,
        {
          validateStatus,
        }
      );
    case "PUT":
        return await client.put(url, data,
          {
            validateStatus,
          }
        );
    case "DELETE":
      return await client.delete(url, {
        validateStatus,
      });
    default:
      throw new Error("Invalid method input.");
  }
}
