/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredPathParam } from '../../lambda-http-helpers';
import { joiUlid } from '../../models/validation/joi-common';
import { defaultProvider } from '../../persistence/schema/entities';
import { defaultDatasetsProvider } from '../../storage/datasets';
import { defaultCloudwatchClient } from '../audit/dea-audit-plugin';
import { auditService } from '../services/audit-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { csvResponse, responseOk } from './dea-lambda-utils';

export const getSystemAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  _datasetsProvider = defaultDatasetsProvider,
  /* istanbul ignore next */
  cloudwatchClient = defaultCloudwatchClient
) => {
  const auditId = getRequiredPathParam(event, 'auditId', joiUlid);
  const result = await auditService.getSystemAuditResult(auditId, cloudwatchClient, repositoryProvider);

  if (result.csvFormattedData) {
    return csvResponse(event, result.csvFormattedData);
  } else {
    return responseOk(event, result);
  }
};
