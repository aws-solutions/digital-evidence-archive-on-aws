/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { listCases } from '../persistence/case';

export const getCases = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  console.log(`Event`, { Data: JSON.stringify(event, null, 2) });
  console.log(`Context`, { Data: JSON.stringify(context, null, 2) });
  let limit: number | undefined;
  let next: string | undefined;
  if (event.queryStringParameters) {
    if (event.queryStringParameters['limit']) {
      limit = parseInt(event.queryStringParameters['limit']);
    }
    next = event.queryStringParameters['next'];
  }

  let nextToken: object | undefined = undefined;
  if (next) {
    nextToken = JSON.parse(Buffer.from(next, 'base64').toString('utf8'));
  }

  const pageOfCases = await listCases(limit, nextToken);

  return {
    statusCode: 200,
    body: JSON.stringify({
      cases: pageOfCases,
      total: pageOfCases.count,
      next: getNextToken(pageOfCases.next),
    }),
  };
};

const getNextToken = (nextToken: object | undefined): string | undefined => {
  if (nextToken) {
    return Buffer.from(JSON.stringify(nextToken)).toString('base64');
  }
  return undefined;
};
