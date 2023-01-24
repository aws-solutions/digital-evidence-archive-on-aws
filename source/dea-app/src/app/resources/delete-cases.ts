/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { defaultProvider } from '../../persistence/schema/entities';
import * as CaseService from '../services/case-service';
import { DEALambda, LambdaContext, LambdaEvent, LambdaResult } from './dea-lambda';

export class DeleteCasesLambda extends DEALambda {
  async execute(event: LambdaEvent, context: LambdaContext, repositoryProvider = defaultProvider) :  Promise<LambdaResult> {
    logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
    logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });
  
    const caseId = getRequiredPathParam(event, 'caseId');
  
    await CaseService.deleteCase(caseId, repositoryProvider);
  
    return {
      statusCode: 204,
    };
  }
}