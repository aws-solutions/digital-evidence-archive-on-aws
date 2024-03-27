/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { getRequiredEnv, getRequiredHeader } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { ParametersProvider, PARAM_PREFIX } from '../../storage/parameters';
import { ValidationError } from '../exceptions/validation-exception';

const stage = getRequiredEnv('STAGE');
const region = getRequiredEnv('AWS_REGION');

// ---------------- GetAvailableEndpoints ----------------
export type AvailableEndpointsSignature = (
  event: APIGatewayProxyEvent,
  parametersProvider: ParametersProvider
) => Promise<string[]>;

export const getAvailableEndpoints: AvailableEndpointsSignature = async (event, parametersProvider) => {
  const deaRoleName = getRequiredHeader(event, 'deaRole');
  const roleActionsPath = `${PARAM_PREFIX}${stage}-${deaRoleName}-actions`;
  const deleteAllowedParamPath = `${PARAM_PREFIX}${stage}/deletionAllowed`;

  let roleActionsList: string[];
  try {
    const roleActionsParam = await parametersProvider.getSsmParameterValue(roleActionsPath);
    roleActionsList = roleActionsParam.split(',') ?? [];
  } catch (e) {
    logger.info(`No SSM roles found for ${deaRoleName} on path ${roleActionsPath}`);
    return [];
  }

  const deletionAllowedParam = await parametersProvider.getSsmParameterValue(deleteAllowedParamPath);
  const deletionAllowed = deletionAllowedParam ?? 'false';

  if (deletionAllowed === 'true' && roleActionsList.includes('/cases/{caseId}/statusPUT')) {
    roleActionsList.push('/cases/{caseId}/filesDELETE');
  }
  return roleActionsList;
};

// ---------------- AUTH PARAMS AND SECRETS ----------------
export interface CognitoSsmParams {
  cognitoDomainUrl: string;
  clientId: string;
  callbackUrl: string;
  identityPoolId: string;
  userPoolId: string;
  agencyIdpName?: string;
}

export const getCognitoSsmParams = async (
  parametersProvider: ParametersProvider
): Promise<CognitoSsmParams> => {
  const cognitoDomainPath = `${PARAM_PREFIX}${stage}-userpool-cognito-domain-param`;
  const clientIdPath = `${PARAM_PREFIX}${stage}-userpool-client-id-param`;
  const callbackUrlPath = `${PARAM_PREFIX}${stage}-client-callback-url-param`;
  const identityPoolIdPath = `${PARAM_PREFIX}${stage}-identity-pool-id-param`;
  const userPoolIdPath = `${PARAM_PREFIX}${stage}-userpool-id-param`;
  const agencyIdpNamePath = `${PARAM_PREFIX}${stage}-agency-idp-name`;

  let cognitoDomainUrl;
  let clientId;
  let callbackUrl;
  let identityPoolId;
  let userPoolId;
  let agencyIdpName;

  try {
    cognitoDomainUrl = await parametersProvider.getSsmParameterValue(cognitoDomainPath);
    if (region === 'us-gov-west-1') {
      // support our one-click in us-gov-west-1, which only has fips endpoints
      cognitoDomainUrl = cognitoDomainUrl.replace('.auth.', '.auth-fips.');
    }

    clientId = await parametersProvider.getSsmParameterValue(clientIdPath);
    callbackUrl = await parametersProvider.getSsmParameterValue(callbackUrlPath);
    identityPoolId = await parametersProvider.getSsmParameterValue(identityPoolIdPath);
    userPoolId = await parametersProvider.getSsmParameterValue(userPoolIdPath);
  } catch (e) {
    throw new ValidationError(
      `Unable to grab the parameters in SSM needed for token verification: ${cognitoDomainUrl}, ${clientId}, ${callbackUrl}, ${identityPoolId}`
    );
  }

  try {
    agencyIdpName = await parametersProvider.getSsmParameterValue(agencyIdpNamePath);
  } catch (e) {
    logger.debug('Looks like IdP is not integrated, continuing...', e);
  }

  return {
    cognitoDomainUrl,
    clientId,
    callbackUrl,
    identityPoolId,
    userPoolId,
    agencyIdpName,
  };
};

export const getClientSecret = async (parametersProvider: ParametersProvider): Promise<string> => {
  const clientSecretPath = `${PARAM_PREFIX}${stage}/clientSecret`;

  try {
    const clientSecret = await parametersProvider.getSecretValue(clientSecretPath);
    if (!clientSecret) {
      throw new ValidationError(`Cognito secret ${clientSecretPath} not found!`);
    }
    return clientSecret;
  } catch (e) {
    throw new ValidationError(`Cognito secret ${clientSecretPath} not found!`);
  }
};

export type CognitoUserPoolInfo = {
  readonly userPoolId: string;
  readonly clientId: string;
};

export const getUserPoolInfo = async (
  parametersProvider: ParametersProvider
): Promise<CognitoUserPoolInfo> => {
  const userPoolIdPath = `${PARAM_PREFIX}${stage}-userpool-id-param`;
  const clientIdPath = `${PARAM_PREFIX}${stage}-userpool-client-id-param`;

  const userPoolId = await parametersProvider.getSsmParameterValue(userPoolIdPath);
  const clientId = await parametersProvider.getSsmParameterValue(clientIdPath);

  if (!userPoolId || !clientId) {
    throw new Error('Unable to grab the parameters in SSM needed for token verification.');
  }

  return {
    userPoolId,
    clientId,
  };
};
