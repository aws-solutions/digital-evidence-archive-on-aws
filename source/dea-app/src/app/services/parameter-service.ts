/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEvent } from 'aws-lambda';
import { getRequiredEnv, getRequiredHeader } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { CacheProvider } from '../../storage/cache';
import { ParametersProvider, PARAM_PREFIX } from '../../storage/parameters';
import { ValidationError } from '../exceptions/validation-exception';

const stage = getRequiredEnv('STAGE');
const region = getRequiredEnv('AWS_REGION');

// CACHE KEYS
const AVAILABLE_ENDPOINTS_ROLE_CACHE_KEY_PREFIX = `AvailableEndpointsForRole`;
const COGNITO_SSM_PARAMS_CACHE_KEY = `CognitoSsmParamsCacheKey`;
const CLIENT_SECRET_CACHE_KEY = `ClientSecretCacheKey`;
const USER_POOL_INFO_CACHE_KEY = `UserPoolInfoCacheKey`;

// ---------------- GetAvailableEndpoints ----------------
export type AvailableEndpointsSignature = (
  event: APIGatewayProxyEvent,
  parametersProvider: ParametersProvider,
  cacheProvider: CacheProvider
) => Promise<string[]>;

export const getAvailableEndpoints: AvailableEndpointsSignature = async (
  event,
  parametersProvider,
  cacheProvider
) => {
  const deaRoleName = getRequiredHeader(event, 'deaRole');

  const roleActionsList = await cacheProvider.get<string[]>(
    `${AVAILABLE_ENDPOINTS_ROLE_CACHE_KEY_PREFIX}${deaRoleName}`,
    async (): Promise<string[]> => {
      const roleActionsPath = `${PARAM_PREFIX}${stage}-${deaRoleName}-actions`;
      const deleteAllowedParamPath = `${PARAM_PREFIX}${stage}/deletionAllowed`;

      const [roleActionsResponse, deletionAllowedReponse] = await parametersProvider.getSsmParametersValue([
        roleActionsPath,
        deleteAllowedParamPath,
      ]);
      const roleActionsList = roleActionsResponse?.split(',') ?? [];
      const deletionAllowed = deletionAllowedReponse ?? 'false';
      if (deletionAllowed === 'true' && roleActionsList.includes('/cases/{caseId}/statusPUT')) {
        roleActionsList.push('/cases/{caseId}/filesDELETE');
      }

      return roleActionsList;
    }
  );

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
  parametersProvider: ParametersProvider,
  cacheProvider: CacheProvider
): Promise<CognitoSsmParams> => {
  const cognitoDomainPath = `${PARAM_PREFIX}${stage}-userpool-cognito-domain-param`;
  const clientIdPath = `${PARAM_PREFIX}${stage}-userpool-client-id-param`;
  const callbackUrlPath = `${PARAM_PREFIX}${stage}-client-callback-url-param`;
  const identityPoolIdPath = `${PARAM_PREFIX}${stage}-identity-pool-id-param`;
  const userPoolIdPath = `${PARAM_PREFIX}${stage}-userpool-id-param`;
  const agencyIdpNamePath = `${PARAM_PREFIX}${stage}-agency-idp-name`;

  const cognitoSsmParam = await cacheProvider.get<CognitoSsmParams>(
    COGNITO_SSM_PARAMS_CACHE_KEY,
    async (): Promise<CognitoSsmParams> => {
      const fields = await parametersProvider.getSsmParametersValue([
        cognitoDomainPath,
        clientIdPath,
        callbackUrlPath,
        identityPoolIdPath,
        userPoolIdPath,
        agencyIdpNamePath,
      ]);
      const [cognitoDomainUrl, clientId, callbackUrl, identityPoolId, userPoolId, agencyIdpName] = fields;
      if (cognitoDomainUrl && clientId && callbackUrl && identityPoolId && userPoolId) {
        let cognitoDomainUrlGovModified: string | undefined;
        if (region === 'us-gov-west-1') {
          // support our one-click in us-gov-west-1, which only has fips endpoints
          cognitoDomainUrlGovModified = cognitoDomainUrl.replace('.auth.', '.auth-fips.');
        }
        return {
          cognitoDomainUrl: cognitoDomainUrlGovModified ?? cognitoDomainUrl,
          clientId,
          callbackUrl,
          identityPoolId,
          userPoolId,
          agencyIdpName,
        };
      } else {
        throw new Error(
          `Unable to grab the parameters in SSM needed for token verification: ${cognitoDomainUrl}, ${clientId}, ${callbackUrl}, ${identityPoolId}`
        );
      }
    }
  );

  return cognitoSsmParam;
};

export const getClientSecret = async (
  parametersProvider: ParametersProvider,
  cacheProvider: CacheProvider
): Promise<string> => {
  const clientSecretPath = `${PARAM_PREFIX}${stage}/clientSecret`;

  return await cacheProvider.get<string>(CLIENT_SECRET_CACHE_KEY, async (): Promise<string> => {
    try {
      const clientSecret = await parametersProvider.getSecretValue(clientSecretPath);
      if (!clientSecret) {
        throw new ValidationError(`Cognito secret ${clientSecretPath} not found!`);
      }
      return clientSecret;
    } catch (e) {
      throw new ValidationError(`Cognito secret ${clientSecretPath} not found!`);
    }
  });
};

export type CognitoUserPoolInfo = {
  readonly userPoolId: string;
  readonly clientId: string;
};

export const getUserPoolInfo = async (
  parametersProvider: ParametersProvider,
  cacheProvider: CacheProvider
): Promise<CognitoUserPoolInfo> => {
  const userPoolIdPath = `${PARAM_PREFIX}${stage}-userpool-id-param`;
  const clientIdPath = `${PARAM_PREFIX}${stage}-userpool-client-id-param`;

  return await cacheProvider.get<CognitoUserPoolInfo>(
    USER_POOL_INFO_CACHE_KEY,
    async (): Promise<CognitoUserPoolInfo> => {
      try {
        const [userPoolId, clientId] = await parametersProvider.getSsmParametersValue([
          userPoolIdPath,
          clientIdPath,
        ]);
        if (!userPoolId || !clientId) {
          throw new Error('Unable to grab the user pool info from SSM.');
        }
        return {
          userPoolId,
          clientId,
        };
      } catch (e) {
        logger.error('Unable to grab the user pool info from SSM.', e);
        throw new Error('Unable to grab the user pool info from SSM.');
      }
    }
  );
};
