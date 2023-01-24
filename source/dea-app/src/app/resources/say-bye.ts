/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '../../logger';
import { DEALambda, LambdaContext, LambdaEvent, LambdaResult } from './dea-lambda';

export class ByeWorldLambda extends DEALambda {
  async execute(event: LambdaEvent, context: LambdaContext) :  Promise<LambdaResult> {
    logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
    logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });
  
    return {
      statusCode: 200,
      body: 'Bye DEA!',
    };
  }
}
