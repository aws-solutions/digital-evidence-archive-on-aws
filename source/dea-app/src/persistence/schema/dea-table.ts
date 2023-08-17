/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Table } from 'dynamodb-onetable';
import { Dynamo } from 'dynamodb-onetable/Dynamo';
import { getCustomUserAgent, getRequiredEnv } from '../../lambda-http-helpers';
import { DeaSchema } from './dea-schema';

const region = process.env.AWS_REGION ?? 'us-east-1';
const client = new Dynamo({ client: new DynamoDBClient({ region, customUserAgent: getCustomUserAgent() }) });
const deaTableName = getRequiredEnv('TABLE_NAME', 'TABLE_NAME is not set in your lambda!');

export const deaTable = new Table({
  client: client,
  name: deaTableName,
  schema: DeaSchema,
  partial: false,
});
