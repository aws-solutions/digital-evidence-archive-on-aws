/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';

export type DEAGatewayProxyHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
  repositoryProvider?: ModelRepositoryProvider,
) => Promise<APIGatewayProxyStructuredResultV2>;
