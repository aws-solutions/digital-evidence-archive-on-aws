/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { randomBytes } from 'crypto';
import {
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectLegalHoldCommand,
  ObjectLockLegalHoldStatus,
  PutObjectLegalHoldCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { aws4Interceptor, Credentials } from 'aws4-axios';
import axios, { AxiosResponse } from 'axios';
import sha256 from 'crypto-js/sha256';
import Joi from 'joi';
import { AuditEventResult, AuditEventType } from '../../app/services/audit-service';
import { Oauth2Token } from '../../models/auth';
import { DeaCase, DeaCaseInput } from '../../models/case';
import { CaseAction } from '../../models/case-action';
import { DeaCaseFile } from '../../models/case-file';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { CaseUserDTO } from '../../models/dtos/case-user-dto';
import { DeaUser } from '../../models/user';
import { caseResponseSchema } from '../../models/validation/case';
import { caseFileResponseSchema } from '../../models/validation/case-file';
import {
  CHUNK_SIZE_BYTES,
  ResponseCaseFilePage,
} from '../../test/app/resources/case-file-integration-test-helper';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';

const s3Client = new S3Client({ region: testEnv.awsRegion });

// we don't want axios throwing an exception on non 200 codes
export const validateStatus = () => true;

export type DeaHttpMethod = 'PUT' | 'POST' | 'GET' | 'DELETE';

const CONTENT_TYPE = 'application/octet-stream';
export const bogusUlid = 'SVPERCA11FRAG111ST1CETCETC';
export const fakeUlid = 'SVPERCA22FRAG111ST2CETCETC';

export const randomSuffix = (length = 10) => {
  return randomBytes(10).toString('hex').substring(0, length);
};

export interface s3Object {
  key: string;
  uploadId?: string;
}

export async function deleteCase(
  baseUrl: string,
  caseUlid: string,
  idToken: Oauth2Token,
  creds: Credentials
): Promise<void> {
  const response = await callDeaAPIWithCreds(`${baseUrl}cases/${caseUlid}/details`, 'DELETE', idToken, creds);

  expect(response.status).toEqual(204);
}

export async function deleteCaseFiles(
  baseUrl: string,
  caseUlid: string,
  caseName: string,
  filePath: string,
  idToken: Oauth2Token,
  creds: Credentials
) {
  let updatedCase = await updateCaseStatus(
    baseUrl,
    idToken,
    creds,
    caseUlid,
    caseName,
    CaseStatus.INACTIVE,
    true
  );

  expect(updatedCase.status).toEqual(CaseStatus.INACTIVE);
  expect(updatedCase.filesStatus).toEqual(CaseFileStatus.DELETING);
  expect(updatedCase.s3BatchJobId).toBeTruthy();

  // Give S3 batch 2 minutes to do the async job. Increase if necessary (EventBridge SLA is 15min)
  const retries = 8;
  while (updatedCase.filesStatus !== CaseFileStatus.DELETED && retries > 0) {
    await delay(15_000);
    updatedCase = await getCase(baseUrl, caseUlid, idToken, creds);

    if (updatedCase.filesStatus === CaseFileStatus.DELETE_FAILED) {
      break;
    }
  }

  expect(updatedCase.filesStatus).toEqual(CaseFileStatus.DELETED);
  expect(updatedCase.totalSizeBytes).toEqual(0);
  expect(updatedCase.objectCount).toEqual(0);
  const listCaseFilesResponse = await listCaseFilesSuccess(baseUrl, idToken, creds, caseUlid, filePath);
  for (const file of listCaseFilesResponse.files) {
    expect(file.status).toEqual(CaseFileStatus.DELETED);
  }
}

export async function createCaseSuccess(
  baseUrl: string,
  deaCase: DeaCaseInput,
  idToken: Oauth2Token,
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

async function getCase(baseUrl: string, caseId: string, idToken: Oauth2Token, creds: Credentials) {
  const getResponse = await callDeaAPIWithCreds(`${baseUrl}cases/${caseId}/details`, 'GET', idToken, creds);

  expect(getResponse.status).toEqual(200);
  return getResponse.data;
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
  cookie: Oauth2Token,
  creds: Credentials,
  data?: unknown
) {
  const client = axios.create({
    headers: {
      cookie: `idToken=${JSON.stringify(cookie)}`,
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

  client.defaults.headers.common['cookie'] = `idToken=${JSON.stringify(cookie)}`;

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
  token: Oauth2Token,
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

export const inviteUserToCase = async (
  deaApiUrl: string,
  cognitoHelper: CognitoHelper,
  targetCaseUlid: string,
  actions: CaseAction[],
  ownerToken: Oauth2Token,
  ownerCreds: Credentials,
  testInvitee: string,
  createUser = false
): Promise<string> => {
  if (createUser) {
    await cognitoHelper.createUser(testInvitee, 'CaseWorker', testInvitee, 'TestUser');
  }

  // initialize the invitee into the DB
  const [inviteeCreds, inviteeToken] = await cognitoHelper.getCredentialsForUser(testInvitee);
  await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', inviteeToken, inviteeCreds);

  // get invitee ulid
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const inviteeUlid = (await getSpecificUserByFirstName(deaApiUrl, testInvitee, ownerToken, ownerCreds))
    .ulid!;

  // invite the user
  const newMembership: CaseUserDTO = {
    userUlid: inviteeUlid,
    caseUlid: targetCaseUlid,
    actions,
  };
  const inviteResponse = await callDeaAPIWithCreds(
    `${deaApiUrl}cases/${targetCaseUlid}/userMemberships`,
    'POST',
    ownerToken,
    ownerCreds,
    newMembership
  );
  expect(inviteResponse.status).toEqual(200);

  return inviteeUlid;
};

export const initiateCaseFileUploadSuccess = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  caseUlid: string | undefined,
  fileName: string,
  filePath: string,
  fileSizeBytes: number,
  contentType: string = CONTENT_TYPE,
  chunkSizeBytes = CHUNK_SIZE_BYTES
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
      fileSizeBytes,
      chunkSizeBytes,
    }
  );

  expect(initiateUploadResponse.status).toEqual(200);
  const initiatedCaseFile: DeaCaseFile = await initiateUploadResponse.data;
  Joi.assert(initiatedCaseFile, caseFileResponseSchema);
  return initiatedCaseFile;
};

export const listCaseFilesSuccess = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  caseUlid: string | undefined,
  filePath: string
): Promise<ResponseCaseFilePage> => {
  const response = await callDeaAPIWithCreds(
    `${deaApiUrl}cases/${caseUlid}/files?filePath=${filePath}`,
    'GET',
    idToken,
    creds
  );

  expect(response.status).toEqual(200);
  return response.data;
};

export const describeCaseFileDetailsSuccess = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  caseUlid: string | undefined,
  fileUlid: string | undefined
): Promise<DeaCaseFile> => {
  const response = await callDeaAPIWithCreds(
    `${deaApiUrl}cases/${caseUlid}/files/${fileUlid}/info`,
    'GET',
    idToken,
    creds
  );

  expect(response.status).toEqual(200);
  return response.data;
};

export const getCaseFileDownloadUrl = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  caseUlid: string | undefined,
  fileUlid: string | undefined
): Promise<string> => {
  const response = await callDeaAPIWithCreds(
    `${deaApiUrl}cases/${caseUlid}/files/${fileUlid}/contents`,
    'GET',
    idToken,
    creds
  );

  expect(response.status).toEqual(200);
  return response.data.downloadUrl;
};

export const updateCaseStatus = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  caseUlid: string | undefined,
  caseName: string,
  status: CaseStatus,
  deleteFiles = true
): Promise<DeaCase> => {
  const response = await callDeaAPIWithCreds(`${deaApiUrl}cases/${caseUlid}/status`, 'PUT', idToken, creds, {
    name: caseName,
    status,
    deleteFiles,
  });

  expect(response.status).toEqual(200);
  const updatedCase: DeaCase = response.data;
  Joi.assert(updatedCase, caseResponseSchema);
  return updatedCase;
};

export const delay = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export const downloadContentFromS3 = async (
  presignedUrl: string,
  contentType: string = CONTENT_TYPE
): Promise<string> => {
  const httpClient = axios.create({
    headers: {
      'Content-Type': contentType,
    },
  });

  const response = await httpClient.get(presignedUrl, { validateStatus });
  expect(response.status).toEqual(200);
  return response.data;
};

export const completeCaseFileUploadSuccess = async (
  deaApiUrl: string,
  idToken: Oauth2Token,
  creds: Credentials,
  caseUlid: string | undefined,
  ulid: string | undefined,
  uploadId: string | undefined,
  fileContent: string
): Promise<DeaCaseFile> => {
  const completeUploadResponse = await callDeaAPIWithCreds(
    `${deaApiUrl}cases/${caseUlid}/files/${ulid}/contents`,
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

export const s3ObjectHasLegalHold = async (object: s3Object): Promise<boolean> => {
  const response = await s3Client.send(
    new GetObjectLegalHoldCommand({
      Bucket: testEnv.datasetsBucketName,
      Key: object.key,
    })
  );

  if (!response.LegalHold) {
    console.log('Was unable to determine the legal hold of object ' + object.uploadId);
  }

  return response.LegalHold?.Status === ObjectLockLegalHoldStatus.ON;
};

export const s3Cleanup = async (s3ObjectsToDelete: s3Object[]): Promise<void> => {
  for (const object of s3ObjectsToDelete) {
    try {
      await s3Client.send(
        new PutObjectLegalHoldCommand({
          Bucket: testEnv.datasetsBucketName,
          Key: object.key,
          LegalHold: { Status: ObjectLockLegalHoldStatus.OFF },
        })
      );
      await s3Client.send(
        new DeleteObjectCommand({
          Key: object.key,
          Bucket: testEnv.datasetsBucketName,
        })
      );
    } catch (e) {
      console.log('[INFO] Could not delete object. Perhaps it does not exist', e);
    }
    try {
      await s3Client.send(
        new AbortMultipartUploadCommand({
          Key: object.key,
          Bucket: testEnv.datasetsBucketName,
          UploadId: object.uploadId,
        })
      );
    } catch (e) {
      console.log('[INFO] Could not delete multipart upload. Perhaps the upload completed', e);
    }
  }
};

export const callAuthAPIWithOauthToken = async (url: string, oauthToken: Oauth2Token, isGetReq = false) => {
  const client = axios.create({
    headers: {
      cookie: `idToken=${JSON.stringify(oauthToken)}`,
    },
  });
  client.defaults.headers.common['cookie'] = `idToken=${JSON.stringify(oauthToken)}`;

  if (isGetReq) {
    return await client.get(url, { withCredentials: true, validateStatus });
  }

  return await client.post(url, undefined, {
    withCredentials: true,
    validateStatus,
  });
};

export const revokeToken = async (deaApiUrl: string, oauthToken: Oauth2Token): Promise<void> => {
  const revokeUrl = `${deaApiUrl}auth/revokeToken`;
  const revokeResponse = await callAuthAPIWithOauthToken(revokeUrl, oauthToken);

  if (revokeResponse.status != 200) {
    throw new Error('Revoke failed');
  }
};

export const useRefreshToken = async (deaApiUrl: string, oauthToken: Oauth2Token): Promise<Oauth2Token> => {
  const refreshUrl = `${deaApiUrl}auth/refreshToken`;
  const refreshResponse = await callAuthAPIWithOauthToken(refreshUrl, oauthToken);

  if (refreshResponse.status != 200) {
    throw new Error('Refresh failed');
  }

  return parseOauthTokenFromCookies(refreshResponse);
};

export const parseOauthTokenFromCookies = (response: AxiosResponse): Oauth2Token => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const cookie = response.headers['set-cookie']![0]!.replace('idToken=', '').split(';')[0];

  // Access token unused, remove
  const cookieData = JSON.parse(cookie);
  if (cookieData.access_token && cookieData.token_type) {
    delete cookieData.access_token;
    delete cookieData.token_type;
  }
  return cookieData;
};

export type CloudTrailEventEntry = {
  eventType: string;
  service: string;
  caseId?: string;
  fileId?: string;
};

export const parseTrailEventsFromAuditQuery = (csvData: string): CloudTrailEventEntry[] => {
  function parseFn(event: string): CloudTrailEventEntry {
    const fields = event.split(', ').map((field) => field.trimEnd());
    return {
      eventType: fields[3],
      service: fields[4],
      caseId: fields[15],
      fileId: fields[16],
    };
  }

  return csvData
    .trimEnd()
    .split('\n')
    .filter((entry) => !entry.includes('Date/Time (UTC)'))
    .filter((entry) => !entry.includes('StartQuery'))
    .filter((entry) => entry.includes('AwsApiCall'))
    .map((entry) => parseFn(entry));
};

// TODO: make it so we do the same for CaseAudit and UserAudit, and
// extend the E2E tests to do the same checks as the CaseFileAudit
export type AuditEventEntry = CaseFileAuditEventEntry | CaseAuditEventEntry;

export type CaseFileAuditEventEntry = {
  eventType: AuditEventType;
  result: boolean;
  eventDetails: string;
  username: string;
  userUlid: string;
  caseId: string;
  fileId: string;
  fileHash?: string;
};

export type CaseAuditEventEntry = {
  eventType: AuditEventType;
  result: boolean;
  eventDetails: string;
  username: string;
  userUlid: string;
  caseId: string;
  fileId?: string;
  fileHash?: string;
  targetUser?: string;
  caseActions?: string;
};

const parseAuditCsv = (csvData: string, parseFn: (entry: string) => AuditEventEntry): AuditEventEntry[] => {
  // Split csv into entries, filter out the heading entries
  return csvData
    .trimEnd()
    .split('\n')
    .filter((entry) => !entry.includes('Date/Time (UTC)'))
    .filter((entry) => !entry.includes('AwsApiCall'))
    .map((entry) => parseFn(entry));
};

export const parseCaseFileAuditCsv = (csvData: string): CaseFileAuditEventEntry[] => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return parseAuditCsv(csvData, parseCaseFileAuditEvent).map((entry) => entry as CaseFileAuditEventEntry);
};

export const parseCaseAuditCsv = (csvData: string): CaseAuditEventEntry[] => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return parseAuditCsv(csvData, parseCaseAuditEvent).map((entry) => entry as CaseAuditEventEntry);
};

const CASE_FILE_EVENT_TYPES = new Set<AuditEventType>([
  AuditEventType.COMPLETE_CASE_FILE_UPLOAD,
  AuditEventType.DOWNLOAD_CASE_FILE,
  AuditEventType.GET_CASE_FILE_AUDIT,
  AuditEventType.GET_CASE_FILE_DETAIL,
  AuditEventType.INITIATE_CASE_FILE_UPLOAD,
  AuditEventType.REQUEST_CASE_FILE_AUDIT,
]);
const CASE_LEVEL_EVENT_TYPES = new Set<AuditEventType>([
  AuditEventType.CREATE_CASE,
  AuditEventType.CREATE_CASE_OWNER,
  AuditEventType.DELETE_CASE,
  AuditEventType.GET_CASE_AUDIT,
  AuditEventType.GET_CASE_DETAILS,
  AuditEventType.GET_CASE_FILES,
  AuditEventType.GET_SCOPED_CASE_INFO,
  AuditEventType.GET_USERS_FROM_CASE,
  AuditEventType.INVITE_USER_TO_CASE,
  AuditEventType.MODIFY_USER_PERMISSIONS_ON_CASE,
  AuditEventType.REMOVE_USER_FROM_CASE,
  AuditEventType.REQUEST_CASE_AUDIT,
  AuditEventType.UPDATE_CASE_DETAILS,
  AuditEventType.UPDATE_CASE_STATUS,
  AuditEventType.AWS_API_CALL,
]);

function parseCaseFileAuditEvent(entry: string): CaseAuditEventEntry {
  const fields = entry.split(', ').map((field) => field.trimEnd());
  const eventType = parseAuditEventType(fields);
  expect(CASE_FILE_EVENT_TYPES.has(eventType));
  let fileHash: string | undefined;
  if (eventType == AuditEventType.COMPLETE_CASE_FILE_UPLOAD) {
    expect(fields[17]).toBeDefined();
    fileHash = fields[17];
  }
  return {
    eventType,
    result: fields[2] === AuditEventResult.SUCCESS,
    eventDetails: fields[3],
    username: fields[7],
    userUlid: fields[9],
    caseId: fields[15],
    fileId: fields[16],
    fileHash,
  };
}

function parseCaseAuditEvent(entry: string): CaseAuditEventEntry {
  const fields = entry.split(', ').map((field) => field.trimEnd());
  const eventType = parseAuditEventType(fields);
  if (CASE_FILE_EVENT_TYPES.has(eventType)) {
    return parseCaseFileAuditEvent(entry);
  }

  if (!CASE_LEVEL_EVENT_TYPES.has(eventType)) {
    fail(`Unrecognized Event Type in Case Level Audit ${eventType}`);
  }

  return {
    eventType,
    result: fields[2] === AuditEventResult.SUCCESS,
    eventDetails: fields[3],
    username: fields[7],
    userUlid: fields[9],
    caseId: fields[15],
    fileId: fields[16],
    fileHash: fields[17],
    targetUser: fields[18],
    caseActions: fields[19],
  };
}

function parseAuditEventType(fields: string[]): AuditEventType {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const eventType = fields[1] as AuditEventType;
  if (eventType === undefined || eventType === AuditEventType.UNKNOWN) {
    fail('Unable to parse event type from log entry');
  }
  return eventType;
}
