/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import BaseAuditPlugin from '@aws/workbench-core-audit/lib/plugins/baseAuditPlugin';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import DeaAuditWriter from './dea-audit-writer';

const region = process.env.AWS_REGION ?? 'us-east-1';

export const defaultCloudwatchClient = new CloudWatchLogsClient({ region });

const theWriter = new DeaAuditWriter(defaultCloudwatchClient);
export const deaAuditPlugin = new BaseAuditPlugin(theWriter);
