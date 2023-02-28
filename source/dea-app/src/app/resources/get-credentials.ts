/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getRequiredPathParam } from '../../lambda-http-helpers';
import { idToken } from '../../models/validation/joi-common';
import { getCredentialsByToken } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const getCredentials: DEAGatewayProxyHandler = async (event) => {
  const idTokenString = getRequiredPathParam(event, 'idToken', idToken);
  const response = await getCredentialsByToken(idTokenString);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  };
};
