/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { getCredentials, getToken } from '../../api/auth';
import { commonLabels } from '../../common/labels';

export default function LoginPage() {
  const router = useRouter();
  const idTokenRef = useRef('');

  useEffect(() => {
    const login = async () => {
      const authCode = typeof router.query.code === 'string' ? router.query.code : '';

      if (authCode) {
        const response = await getToken(authCode);
        idTokenRef.current = response.id_token;
        const refreshToken = response.refresh_token;
        const credentials = await getCredentials(idTokenRef.current);

        localStorage.setItem('idToken', idTokenRef.current);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('accessKeyId', credentials.AccessKeyId);
        localStorage.setItem('secretAccessKey', credentials.SecretKey);
        localStorage.setItem('sessionToken', credentials.SessionToken);
        await router.push('/');
      }
    };

    login().catch((e) => console.log(e));
  }, [router]);

  return (
    <div>
      <h1>{commonLabels.loginLabel}</h1>
    </div>
  );
}
