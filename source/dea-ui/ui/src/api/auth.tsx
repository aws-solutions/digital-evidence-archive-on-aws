/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Oauth2Token, RevokeToken } from '@aws/dea-app/lib/models/auth';
import useSWR from 'swr';
import { httpApiGet, httpApiPost } from '../helpers/apiHelper';
import { DeaListResult } from './cases';

export interface Credentials {
  AccessKeyId: string;
  SecretKey: string;
  SessionToken: string;
}

export const getToken = async (authCode: string, codeVerifier?: string): Promise<Oauth2Token> => {
  try {
    const response: Oauth2Token = await httpApiPost(`auth/${authCode}/token`, { codeVerifier });
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getCredentials = async (idToken: string) => {
  try {
    const response: Credentials = await httpApiGet(`auth/credentials/${idToken}/exchange`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getLoginUrl = async () => {
  try {
    const response: string = await httpApiGet(`auth/loginUrl?callbackUrl=${callbackUrl}`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getLogoutUrl = async () => {
  try {
    const response: string = await httpApiGet(`auth/logoutUrl`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const revokeToken = async (revokeToken: RevokeToken): Promise<void> => {
  await httpApiPost(`auth/revokeToken`, { ...revokeToken });
};

export const useAvailableEndpoints = (): DeaListResult<string> => {
  const { data, error } = useSWR('availableEndpoints', httpApiGet<{ endpoints: string[] }>);

  return { data: data?.endpoints ?? [], isLoading: !data && !error };
};
