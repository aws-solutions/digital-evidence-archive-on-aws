/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import _ from 'lodash';
import {
  AuditEventResult,
  AuditEventSource,
  AuditEventType,
  CJISAuditEventBody,
  IdentityType,
} from '../app/services/audit-service';

const stage = process.env.STAGE ?? 'devsample';

const dummyEvent: APIGatewayProxyEvent = {
  resource: '/cases/{caseId}/details',
  path: '/cases/01GSX40H73JQ9Q2T2EERPYWN6C/details',
  httpMethod: 'GET',
  headers: {
    'CloudFront-Forwarded-Proto': 'https',
    'CloudFront-Is-Desktop-Viewer': 'true',
    'CloudFront-Is-Mobile-Viewer': 'false',
    'CloudFront-Is-SmartTV-Viewer': 'false',
    'CloudFront-Is-Tablet-Viewer': 'false',
    'CloudFront-Viewer-ASN': '123',
    'CloudFront-Viewer-Country': 'US',
    Host: 'abc123.execute-api.us-east-1.amazonaws.com',
    'User-Agent': 'axios/0.27.2',
    Via: 'middleearth',
    'X-Amz-Cf-Id': 'bogus',
    'x-amz-date': '20230222T175120Z',
    'X-Amz-Security-Token': 'bogus',
    'X-Amzn-Trace-Id': 'Root=123',
    'X-Forwarded-For': '0.0.0.0, 1.1.1.1',
    'X-Forwarded-Port': '443',
    'X-Forwarded-Proto': 'https',
  },
  multiValueHeaders: {
    'CloudFront-Forwarded-Proto': ['https'],
    'CloudFront-Is-Desktop-Viewer': ['true'],
    'CloudFront-Is-Mobile-Viewer': ['false'],
    'CloudFront-Is-SmartTV-Viewer': ['false'],
    'CloudFront-Is-Tablet-Viewer': ['false'],
    'CloudFront-Viewer-ASN': ['123'],
    'CloudFront-Viewer-Country': ['US'],
    Host: ['123.execute-api.us-east-1.amazonaws.com'],
    'User-Agent': ['axios/0.27.2'],
    Via: ['middleearth'],
    'X-Amz-Cf-Id': ['123'],
    'x-amz-date': ['20230222T175120Z'],
    'X-Amz-Security-Token': ['bogus'],
    'X-Amzn-Trace-Id': ['123'],
    'X-Forwarded-For': ['0.0.0.0, 1.1.1.1'],
    'X-Forwarded-Port': ['443'],
    'X-Forwarded-Proto': ['https'],
  },
  queryStringParameters: null,
  multiValueQueryStringParameters: null,
  pathParameters: {},
  stageVariables: null,
  requestContext: {
    resourceId: 'abc',
    resourcePath: '/cases/{caseId}/details',
    httpMethod: 'GET',
    extendedRequestId: 'abc123',
    requestTime: '22/Feb/2023:17:51:21 +0000',
    path: '/dev/cases/01GSX40H73JQ9Q2T2EERPYWN6C/details',
    accountId: '123456789012',
    protocol: 'HTTP/1.1',
    stage: 'dev',
    domainPrefix: 'abc123',
    requestTimeEpoch: 1677088281160,
    requestId: '123',
    identity: {
      cognitoIdentityPoolId: 'us-east-1:a-b-c-1',
      accountId: '123456789012',
      cognitoIdentityId: 'us-east-1:1-2-3-a-b-c',
      caller: 'AKIAIOSFODNN7EXAMPLE:CognitoIdentityCredentials',
      sourceIp: '204.246.162.41',
      principalOrgId: 'o-u3xb16c77v',
      accessKey: 'AKIAIOSFODNN7EXAMPLE',
      cognitoAuthenticationType: 'authenticated',
      cognitoAuthenticationProvider:
        'cognito-idp.us-east-1.amazonaws.com/us-east-1_,cognito-idp.us-east-1.amazonaws.com/us-east-1:CognitoSignIn:1-2-3-4',
      userArn: 'arn:aws:sts::123456789012:assumed-role/somethingorother/CognitoIdentityCredentials',
      userAgent: 'axios/0.27.2',
      user: 'AKIAIOSFODNN7EXAMPLE:CognitoIdentityCredentials',
      apiKey: null,
      apiKeyId: null,
      clientCert: null,
    },
    domainName: '123.execute-api.us-east-1.amazonaws.com',
    apiId: '123',
    authorizer: null,
  },
  body: null,
  isBase64Encoded: false,
};

export const dummyContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: '',
  functionVersion: '',
  memoryLimitInMB: '',
  invokedFunctionArn: '',
  awsRequestId: '',
  logStreamName: '',
  logGroupName: '',
  getRemainingTimeInMillis: () => 100,
  done: () => {
    /* do nothing */
  },
  fail: () => {
    /* do nothing */
  },
  succeed: () => {
    /* do nothing */
  },
};

const dummyAuditEvent: CJISAuditEventBody = {
  dateTime: new Date().toISOString(),
  requestPath: '/',
  sourceComponent: AuditEventSource.API_GATEWAY,
  eventType: AuditEventType.CREATE_CASE,
  actorIdentity: {
    idType: IdentityType.COGNITO_ID,
    sourceIp: '0.0.0.0',
    idPoolUserId: 'us-east-1:1-2-3-4',
  },
  result: AuditEventResult.FAILURE,
  eventID: '11111111-1111-1111-1111-111111111111',
};

export const getDummyEvent = (addedData: object = {}): APIGatewayProxyEvent => {
  return _.cloneDeep({
    ...dummyEvent,
    ...addedData,
  });
};

export const getDummyAuditEvent = (): CJISAuditEventBody => {
  return _.cloneDeep({
    ...dummyAuditEvent,
  });
};

export const setCookieToCookie = (response: APIGatewayProxyResult): string => {
  if (!response.headers) {
    throw new Error('headers not present when attempting to create cookie');
  }
  if (typeof response.headers['Set-Cookie'] !== 'string') {
    throw new Error('set-cookie header is of unexpected type');
  }
  const setCookie = response.headers['Set-Cookie'];
  return setCookie.substring(0, setCookie.indexOf(';'));
};

export const setUserArnWithRole = (event: APIGatewayProxyEvent, roleName: string) => {
  event.requestContext.identity.userArn = `arn:aws:sts::123456789012:assumed-role/${stage}-${roleName}Role/CognitoIdentityCredentials`;
};
