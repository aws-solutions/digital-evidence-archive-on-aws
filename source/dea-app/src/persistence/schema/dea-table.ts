/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Table } from 'dynamodb-onetable';
import { Dynamo } from 'dynamodb-onetable/Dynamo';
import { DeaSchema } from './dea-schema';

const region = process.env.AWS_REGION ?? 'us-east-1'
const client = new Dynamo({ client: new DynamoDBClient({ region }) });

export const deaTable = new Table({
  client: client,
  name: 'DeaTable',
  schema: DeaSchema,
  partial: false,
});
