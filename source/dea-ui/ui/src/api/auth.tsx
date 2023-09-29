/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import useSWR from 'swr';
import { httpApiGet, httpApiPost } from '../helpers/apiHelper';
import { DeaListResult } from './models/api-results';

export interface TokenResponse {
  username: string;
  idToken: string;
  identityPoolId: string;
  userPoolId: string;
  expiresIn: number;
}

export const getToken = async (authCode: string, codeVerifier: string): Promise<TokenResponse> => {
  try {
    const response: TokenResponse = await httpApiPost(`auth/${authCode}/token`, { codeVerifier });
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const refreshToken = async (): Promise<TokenResponse> => {
  try {
    const response: TokenResponse = await httpApiPost(`auth/refreshToken`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getLoginUrl = async (callbackUrl: string) => {
  try {
    const response: string = await httpApiGet(`auth/loginUrl?callbackUrl=${callbackUrl}`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const getLogoutUrl = async (callbackUrl: string) => {
  try {
    const response: string = await httpApiGet(`auth/logoutUrl?callbackUrl=${callbackUrl}`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const revokeToken = async (): Promise<void> => {
  await httpApiPost(`auth/revokeToken`, undefined);
};

export const useAvailableEndpoints = (): DeaListResult<string> => {
  const { data, error } = useSWR('availableEndpoints', httpApiGet<{ endpoints: string[] }>);

  return { data: data?.endpoints ?? [], isLoading: !data && !error };
};
