/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import 'source-map-support/register';
import { DeaBackendConstruct } from './constructs/dea-backend-stack';
import { DeaRestApiConstruct } from './constructs/dea-rest-api';
import { validateBackendConstruct } from './test/infra/validate-backend-construct';

export { DeaBackendConstruct, DeaRestApiConstruct, validateBackendConstruct };
