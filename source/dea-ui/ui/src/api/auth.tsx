/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Oauth2Token, RevokeToken } from '@aws/dea-app/lib/models/auth';
import { httpApiGet, httpApiPost } from '../helpers/apiHelper';

export interface Credentials {
  AccessKeyId: string;
  SecretKey: string;
  SessionToken: string;
}

const getToken = async (authCode: string, codeVerifier?: string): Promise<Oauth2Token> => {
  try {
    const response: Oauth2Token = await httpApiPost(`auth/${authCode}/token`, { codeVerifier });
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getCredentials = async (idToken: string) => {
  try {
    const response: Credentials = await httpApiGet(`auth/credentials/${idToken}/exchange`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getLoginUrl = async (callbackUrl: string) => {
  try {
    const response: string = await httpApiGet(`auth/loginUrl?callbackUrl=${callbackUrl}`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getLogoutUrl = async () => {
  try {
    const response: string = await httpApiGet(`auth/logoutUrl`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const revokeToken = async (revokeToken: RevokeToken): Promise<void> => {
  await httpApiPost(`auth/revokeToken`, { ...revokeToken });
};

export { getToken, getCredentials, getLoginUrl, getLogoutUrl, revokeToken };
