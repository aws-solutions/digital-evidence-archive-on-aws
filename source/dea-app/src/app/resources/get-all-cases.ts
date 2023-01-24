/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '../../logger';
import { listCases } from '../../persistence/case';
import { defaultProvider } from '../../persistence/schema/entities';
import { DEALambda, LambdaContext, LambdaEvent, LambdaResult } from './dea-lambda';

export class GetAllCasesLambda extends DEALambda {
  async execute(event: LambdaEvent, context: LambdaContext, repositoryProvider = defaultProvider) :  Promise<LambdaResult> {
    logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
    logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });
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
  
    const pageOfCases = await listCases(limit, nextToken, repositoryProvider);
  
    return {
      statusCode: 200,
      body: JSON.stringify({
        cases: pageOfCases,
        total: pageOfCases.count,
        next: getNextToken(pageOfCases.next),
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
}

const getNextToken = (nextToken: object | undefined): string | undefined => {
  if (nextToken) {
    return Buffer.from(JSON.stringify(nextToken)).toString('base64');
  }
  return undefined;
};
