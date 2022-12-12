/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyResultV2 } from 'aws-lambda';

export const sayBye = async ()
  : Promise<APIGatewayProxyResultV2> => {
  return {
    statusCode: 200,
    body: 'Bye DEA!',
  };
};
