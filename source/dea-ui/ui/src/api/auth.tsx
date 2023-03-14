/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Oauth2Token } from '@aws/dea-app';
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
  }
};

const getLoginUrl = async () => {
  try {
    const response = await httpApiGet(`auth/loginUrl`, {});
    return response;
  } catch (error) {
    console.error(error);
  }
};

export { getToken, getCredentials, getLoginUrl };
