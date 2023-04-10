/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { getOauthToken } from '../../lambda-http-helpers';
import { getCredentialsByToken } from '../services/auth-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';
import { responseOk } from './dea-lambda-utils';

export const getCredentials: DEAGatewayProxyHandler = async (event) => {
  const idTokenString = getOauthToken(event);
  const response = await getCredentialsByToken(idTokenString.id_token);

  return responseOk(response);
};
