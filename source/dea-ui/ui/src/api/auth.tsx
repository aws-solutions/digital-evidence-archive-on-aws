/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Oauth2Token, RevokeToken } from '@aws/dea-app/lib/models/auth';
import { httpApiGet, httpApiPost } from '../helpers/apiHelper';

const getToken = async (authCode: string): Promise<Oauth2Token> => {
  try {
    const response = await httpApiPost(`auth/${authCode}/token`, { authCode });
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getCredentials = async (idToken: string) => {
  try {
    const response = await httpApiGet(`auth/credentials/${idToken}/exchange`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getLoginUrl = async () => {
  try {
    const response = await httpApiGet(`auth/loginUrl`, {});
    return response;
  } catch (error) {
    console.error(error);
    throw error;
  }
};

const getLogoutUrl = async () => {
  try {
    const response = await httpApiGet(`auth/logoutUrl`, {});
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
