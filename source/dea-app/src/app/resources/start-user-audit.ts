/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { getQueryParam, getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultCloudwatchClient } from '../audit/dea-audit-plugin';
import { auditService } from '../services/audit-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const startUserAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */ // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _repositoryProvider = defaultProvider,
  /* istanbul ignore next */ // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  cloudwatchClient = defaultCloudwatchClient
) => {
  const now = Date.now();
  const userId = getRequiredPathParam(event, 'userId', joiUlid);
  const start = getQueryParam(event, 'from', '0', Joi.number().integer());
  const end = getQueryParam(event, 'to', now.toString(), Joi.number().integer());
  const startTime = Number.parseInt(start);
  const endTime = Number.parseInt(end);
  const queryId = await auditService.requestAuditForUser(
    userId,
    startTime,
    endTime,
    userId,
    cloudwatchClient,
    _repositoryProvider
  );

  return responseOk(event, { auditId: queryId });
};
