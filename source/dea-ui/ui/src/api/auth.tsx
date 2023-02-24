/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { httpApiGet, httpApiPost } from '../helpers/apiHelper';

const STAGE = process.env.STAGE ?? 'chewbacca';

const getToken = async (authCode: string) => {
  try {
    const response = await httpApiPost(`/${STAGE}/auth/getToken/${authCode}/`, { authCode });
    return response;
  } catch (error) {
    console.error(error);
  }
};

const getCredentials = async (idToken: string) => {
  try {
    const response = await httpApiGet(`/${STAGE}/auth/getCredentials/${idToken}`, {});
    return response;
  } catch (error) {
    console.error(error);
  }
};

export { getToken, getCredentials };
