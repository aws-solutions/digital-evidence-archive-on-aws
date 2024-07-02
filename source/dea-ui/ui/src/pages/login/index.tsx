/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, StatusIndicator } from '@cloudscape-design/components';
import Head from 'next/head';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { getToken } from '../../api/auth';
import { commonLabels, navigationLabels, systemUseNotificationText } from '../../common/labels';
import { useAuthentication } from '../../context/AuthenticationContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useSettings } from '../../context/SettingsContext';
import { calculateExpirationDate, getCredentialsByToken } from '../../helpers/authService';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuthentication();
  const { pushNotification } = useNotifications();
  const { settings } = useSettings();

  const pageName = navigationLabels.loginLabel;

  useEffect(() => {
    const login = async () => {
      const authCode = typeof searchParams.get('code') === 'string' ? searchParams.get('code') : '';

      // Starting with React 18, there is an undocumented behavior where useEffect() can be called multiple times due to concurrent rendering
      // To prevent disallowed duplicate PKCE token fetches, credentials are fetched only once initially and each time after expiration
      const expirationTime = sessionStorage.getItem('tokenExpirationTime');
      const credsInactive = expirationTime === null || Date.now() >= Number(expirationTime);
      if (authCode && credsInactive) {
        const codeVerifier = sessionStorage.getItem('pkceVerifier');
        if (!codeVerifier) {
          signIn();
          return;
        }

        try {
          const response = await getToken(authCode, codeVerifier);
          const username = response.username;
          const credentials = await getCredentialsByToken(
            response.idToken,
            response.identityPoolId,
            response.userPoolId
          );

          localStorage.setItem('username', username);
          sessionStorage.setItem('accessKeyId', credentials.AccessKeyId);
          sessionStorage.setItem('secretAccessKey', credentials.SecretKey);
          sessionStorage.setItem('sessionToken', credentials.SessionToken);
          sessionStorage.setItem(
            'tokenExpirationTime',
            calculateExpirationDate(response.expiresIn).toString()
          );
          router.push('/');
          pushNotification('info', systemUseNotificationText);
        } catch (e) {
          console.log(e);
          signIn();
          return;
        }
      }
    };

    login().catch((e) => console.log(e));
  }, [router, searchParams, signIn, pushNotification]);

  return (
    <>
      <Head>
        <title>
          {settings.name} - {pageName}
        </title>
      </Head>
      <Box textAlign="center" color="inherit" margin="xxl" padding="xxl">
        <div>
          <p>
            <span aria-live="polite" aria-label={commonLabels.loginLabel}></span>{' '}
            <StatusIndicator type="loading">{commonLabels.loadingLabel}</StatusIndicator>
          </p>
        </div>
        <div>
          <h3>{commonLabels.loginLabel}</h3>
        </div>
      </Box>
    </>
  );
}
