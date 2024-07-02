/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getRequiredEnv, getRequiredPathParam } from '../../../lambda-http-helpers';
import { joiUlid } from '../../../models/validation/joi-common';
import { AuditType } from '../../../persistence/schema/dea-schema';
import { auditService } from '../../services/audit-service';
import { getRequiredCase } from '../../services/case-service';
import { DEAGatewayProxyHandler, defaultProviders } from '../dea-gateway-proxy-handler';
import { responseOk } from '../dea-lambda-utils';

export const getCaseAudit: DEAGatewayProxyHandler = async (
  event,
  context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  providers = defaultProviders
) => {
  const auditId = getRequiredPathParam(event, 'auditId', joiUlid);
  const caseId = getRequiredPathParam(event, 'caseId', joiUlid);
  const subnetCIDR = getRequiredEnv('SOURCE_IP_MASK_CIDR');

  await getRequiredCase(caseId, providers.repositoryProvider);

  const result = await auditService.getAuditResult(
    auditId,
    caseId,
    AuditType.CASE,
    providers.athenaClient,
    providers.repositoryProvider,
    `${event.requestContext.identity.sourceIp}/${subnetCIDR}`
  );

  return responseOk(event, result);
};
