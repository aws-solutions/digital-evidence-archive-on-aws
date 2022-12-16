/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '../../logger';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { createCase } from '../../persistence/case';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const createCases: DEAGatewayProxyHandler = async (event, context) => {
  logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
  logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

  if (event.body) {
    const deaCase: DeaCase = JSON.parse(event.body);
    return {
      statusCode: 200,
      body: JSON.stringify(
        await createCase({
          name: deaCase.name,
          status: CaseStatus.ACTIVE,
        })
      ),
    };
  } else {
    return {
      statusCode: 400,
      body: '',
    };
  }
};
