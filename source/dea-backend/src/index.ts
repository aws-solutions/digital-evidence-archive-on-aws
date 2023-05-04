/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import 'source-map-support/register';
import { deaConfig } from './config';
import { createCfnOutput } from './constructs/construct-support';
import { DeaAuditTrail } from './constructs/dea-audit-trail';
import { DeaAuth, DeaAuthStack } from './constructs/dea-auth';
import { DeaBackendConstruct } from './constructs/dea-backend-stack';
import { DeaEventHandlers } from './constructs/dea-event-handlers';
import { DeaParameters, DeaParametersStack } from './constructs/dea-parameters';
import { DeaRestApiConstruct } from './constructs/dea-rest-api';
import { addSnapshotSerializers } from './test/infra/dea-snapshot-serializers';
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
  deaConfig,
  validateBackendConstruct,
  createCfnOutput,
  addSnapshotSerializers,
};
