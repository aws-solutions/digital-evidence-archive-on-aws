/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEventV2, Context } from 'aws-lambda';

export const dummyEvent: APIGatewayProxyEventV2 = {
  queryStringParameters: {},
  requestContext: {
    accountId: '',
    apiId: '',
    domainName: '',
    domainPrefix: '',
    requestId: '',
    http: {
      method: 'GET',
      path: '',
      protocol: '',
      sourceIp: '',
      userAgent: '',
    },
    routeKey: '',
    stage: '',
    time: '',
    timeEpoch: 1,
  },
  isBase64Encoded: false,
  version: '1',
  routeKey: '',
  rawPath: '',
  rawQueryString: '',
  headers: {},
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
