/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getRequiredPathParam } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { DeaCase } from '../../models/case';
import { updateCaseSchema } from '../../models/validation/case';
import { defaultProvider } from '../../persistence/schema/entities';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseService from '../services/case-service';
import { DEALambda, LambdaContext, LambdaEvent, LambdaResult } from './dea-lambda';

export class UpdateCasesLambda extends DEALambda {
  async execute(event: LambdaEvent, context: LambdaContext, repositoryProvider = defaultProvider) :  Promise<LambdaResult> {
    logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
    logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });
  
    const caseId = getRequiredPathParam(event, 'caseId');
  
    if (!event.body) {
      throw new ValidationError('Update cases payload missing.');
    }
  
    const deaCase: DeaCase = JSON.parse(event.body);
  
    Joi.assert(deaCase, updateCaseSchema);
  
    if (caseId !== deaCase.ulid) {
      throw new ValidationError('Requested Case Ulid does not match resource');
    }
  
    const caseUpdateResult = await CaseService.updateCases(deaCase, repositoryProvider);
    return {
      statusCode: 200,
      body: JSON.stringify(caseUpdateResult),
    };
  }
}