/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { randomBytes } from 'crypto';
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios from 'axios';
import sha256 from 'crypto-js/sha256';
import Joi from 'joi';
import { DeaCase, DeaCaseInput } from '../../models/case';
import { DeaCaseFile } from '../../models/case-file';
import { DeaUser } from '../../models/user';
import { caseResponseSchema } from '../../models/validation/case';
import { caseFileResponseSchema } from '../../models/validation/case-file';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';

// we don't want axios throwing an exception on non 200 codes
export const validateStatus = () => true;

export type DeaHttpMethod = 'PUT' | 'POST' | 'GET' | 'DELETE';

const CONTENT_TYPE = 'application/octet-stream';
export const bogusUlid = 'SVPERCA11FRAG111ST1CETCETC';

export const randomSuffix = (length = 10) => {
  return randomBytes(10).toString('hex').substring(0, length);
};

export async function deleteCase(
  baseUrl: string,
  caseUlid: string,
  idToken: string,
  creds: Credentials
): Promise<void> {
  const response = await callDeaAPIWithCreds(`${baseUrl}cases/${caseUlid}`, 'DELETE', idToken, creds);

  expect(response.status).toEqual(204);
}

export async function createCaseSuccess(
  baseUrl: string,
  deaCase: DeaCaseInput,
  idToken: string,
  creds: Credentials
): Promise<DeaCase> {
  const response = await callDeaAPIWithCreds(`${baseUrl}cases`, 'POST', idToken, creds, deaCase);

  if (response.status !== 200) {
    console.log(response.data);
  }
  expect(response.status).toEqual(200);

  const createdCase: DeaCase = response.data;
  Joi.assert(createdCase, caseResponseSchema);
  expect(createdCase.name).toEqual(deaCase.name);
  return createdCase;
}

export async function callDeaAPI(
  testUser: string,
  url: string,
  cognitoHelper: CognitoHelper,
  method: DeaHttpMethod,
  data?: unknown
) {
  const [creds, idToken] = await cognitoHelper.getCredentialsForUser(testUser);
  return await callDeaAPIWithCreds(url, method, idToken, creds, data);
}

export async function callDeaAPIWithCreds(
  url: string,
  method: DeaHttpMethod,
  idToken: string,
  creds: Credentials,
  data?: unknown
) {
  const client = axios.create({
    headers: {
      idToken: idToken,
    },
  });

  const interceptor = aws4Interceptor(
    {
      service: 'execute-api',
      region: testEnv.awsRegion,
    },
    creds
  );

  client.interceptors.request.use(interceptor);

  client.defaults.headers.common['idToken'] = idToken;

  switch (method) {
    case 'GET':
      return await client.get(url, {
        validateStatus,
      });
    case 'POST':
      return await client.post(url, data, {
        validateStatus,
      });
    case 'PUT':
      return await client.put(url, data, {
        validateStatus,
      });
    case 'DELETE':
      return await client.delete(url, {
        validateStatus,
      });
  }
}

export const getSpecificUserByFirstName = async (
  deaApiUrl: string,
  userFirstName: string,
  token: string,
  creds: Credentials
): Promise<DeaUser> => {
  const userResponse = await callDeaAPIWithCreds(
    `${deaApiUrl}users?nameBeginsWith=${userFirstName}`,
    'GET',
    token,
    creds
  );
  expect(userResponse.status).toEqual(200);
  const fetchedUsers: DeaUser[] = await userResponse.data.users;

  const user = fetchedUsers.find((user) => user.firstName === userFirstName);
  if (!user) {
    throw new Error(`Expected user ${userFirstName} not found`);
  }

  return user;
};

export const initiateCaseFileUploadSuccess = async (
  deaApiUrl: string,
  idToken: string,
  creds: Credentials,
  caseUlid: string | undefined,
  fileName: string,
  filePath: string,
  fileSizeMb: number,
  contentType: string = CONTENT_TYPE
): Promise<DeaCaseFile> => {
  const initiateUploadResponse = await callDeaAPIWithCreds(
    `${deaApiUrl}cases/${caseUlid}/files`,
    'POST',
    idToken,
    creds,
    {
      caseUlid,
      fileName,
      filePath,
      contentType,
      fileSizeMb,
    }
  );

  expect(initiateUploadResponse.status).toEqual(200);
  const initiatedCaseFile: DeaCaseFile = await initiateUploadResponse.data;
  Joi.assert(initiatedCaseFile, caseFileResponseSchema);
  return initiatedCaseFile;
};

export const uploadContentToS3 = async (
  presignedUrls: readonly string[],
  fileContent: string
): Promise<void> => {
  const uploadResponses: Promise<Response>[] = [];

  const httpClient = axios.create({
    headers: {
      'Content-Type': CONTENT_TYPE,
    },
  });

  presignedUrls.forEach((url, index) => {
    uploadResponses[index] = httpClient.put(url, fileContent, { validateStatus });
  });

  await Promise.all(uploadResponses).then((responses) => {
    responses.forEach((response) => {
      expect(response.status).toEqual(200);
    });
  });
};

export const completeCaseFileUploadSuccess = async (
  deaApiUrl: string,
  idToken: string,
  creds: Credentials,
  caseUlid: string | undefined,
  ulid: string | undefined,
  uploadId: string | undefined,
  fileContent: string
): Promise<DeaCaseFile> => {
  const completeUploadResponse = await callDeaAPIWithCreds(
    `${deaApiUrl}cases/${caseUlid}/files/${ulid}`,
    'PUT',
    idToken,
    creds,
    {
      caseUlid,
      ulid,
      sha256Hash: sha256(fileContent).toString(),
      uploadId,
    }
  );

  if (completeUploadResponse.status !== 200) {
    console.log(completeUploadResponse);
  }
  expect(completeUploadResponse.status).toEqual(200);
  const uploadedCaseFile: DeaCaseFile = await completeUploadResponse.data;
  Joi.assert(uploadedCaseFile, caseFileResponseSchema);
  return uploadedCaseFile;
};
