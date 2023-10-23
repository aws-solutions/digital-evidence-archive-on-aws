/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import 'source-map-support/register';
import { deaConfig } from './config';
import { createCfnOutput } from './constructs/construct-support';
import { DeaAppRegisterConstruct } from './constructs/dea-app-registry';
import { DeaAuditTrail } from './constructs/dea-audit-trail';
import { DeaAuth, DeaAuthStack } from './constructs/dea-auth';
import { DeaBackendConstruct } from './constructs/dea-backend-stack';
import { DeaEventHandlers } from './constructs/dea-event-handlers';
import { DeaOperationalDashboard } from './constructs/dea-ops-dashboard';
import { DeaParameters, DeaParametersStack } from './constructs/dea-parameters';
import { DeaRestApiConstruct } from './constructs/dea-rest-api';
import { addLambdaSuppressions, addResourcePolicySuppressions } from './helpers/nag-suppressions';
import { addSnapshotSerializers } from './test/infra/dea-snapshot-serializers';
import { validateAppRegistryConstruct } from './test/infra/validate-app-registry-construct';
import { validateAuthConstruct } from './test/infra/validate-auth-construct';
import { validateBackendConstruct } from './test/infra/validate-backend-construct';

export {
  DeaAuditTrail,
  DeaAuth,
  DeaAuthStack,
  DeaBackendConstruct,
  DeaParameters,
  DeaParametersStack,
  DeaRestApiConstruct,
  DeaEventHandlers,
  DeaAppRegisterConstruct,
  DeaOperationalDashboard,
  deaConfig,
  addLambdaSuppressions,
  addResourcePolicySuppressions,
  validateBackendConstruct,
  validateAppRegistryConstruct,
  createCfnOutput,
  addSnapshotSerializers,
  validateAuthConstruct,
};
