/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { defaultProvider } from '../../persistence/schema/entities';
import { listCaseFilesByFilePath } from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { getNextToken } from './get-next-token';

export const listCaseFiles: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
) => {
  let limit: number | undefined;
  let next: string | undefined;
  let filePath = '/';
  if (event.queryStringParameters) {
    if (event.queryStringParameters['limit']) {
      limit = parseInt(event.queryStringParameters['limit']);
    }
    next = event.queryStringParameters['next'];
    if (event.queryStringParameters['filePath']) {
      filePath = event.queryStringParameters['filePath'];
    }
  }

  const caseId = getRequiredPathParam(event, 'caseId');
  // todo: make sure case exists

  let nextToken: object | undefined = undefined;
  if (next) {
    nextToken = JSON.parse(Buffer.from(next, 'base64').toString('utf8'));
  }

  const pageOfCaseFiles = await listCaseFilesByFilePath(
    caseId,
    filePath,
    limit,
    repositoryProvider,
    nextToken
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      cases: pageOfCaseFiles,
      total: pageOfCaseFiles.count,
      next: getNextToken(pageOfCaseFiles.next),
    }),
  };
};
