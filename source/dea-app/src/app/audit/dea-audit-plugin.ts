/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import BaseAuditPlugin from '@aws/workbench-core-audit/lib/plugins/baseAuditPlugin';
import { AthenaClient } from '@aws-sdk/client-athena';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { getCustomUserAgent, getRequiredEnv } from '../../lambda-http-helpers';
import DeaAuditWriter from './dea-audit-writer';

const region = getRequiredEnv('AWS_REGION', 'us-east-1');
const fipsSupported = getRequiredEnv('AWS_USE_FIPS_ENDPOINT', 'false') === 'true';

export const defaultCloudwatchClient = new CloudWatchLogsClient({
  region,
  useFipsEndpoint: fipsSupported,
  customUserAgent: getCustomUserAgent(),
});

export const defaultAthenaClient = new AthenaClient({
  region,
  useFipsEndpoint: fipsSupported,
  customUserAgent: getCustomUserAgent(),
});

const theWriter = new DeaAuditWriter(defaultCloudwatchClient);
export const deaAuditPlugin = new BaseAuditPlugin(theWriter);
