/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Spinner } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { getToken } from '../../api/auth';
import { commonLabels } from '../../common/labels';
import { useAuthentication } from '../../context/AuthenticationContext';
import { useNotifications } from '../../context/NotificationsContext';
import { calculateExpirationDate, getCredentialsByToken } from '../../helpers/authService';

const SYSTEM_USE_NOTIFICATION_TEXT =
  'CUSTOMIZE YOUR SYSTEM USE NOTIFICATION TEXT according \
to your local laws and regulations. This is needed to fulfill CJIS Policy 5.5.4. (Use Notification). \
Refer to the Implementation Guide for instructions on how to customize this text, and review \
CJIS Policy 5.5.4 for latest CJIS requirements.';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuthentication();
  const { pushNotification } = useNotifications();

  useEffect(() => {
    const login = async () => {
      const authCode = typeof router.query.code === 'string' ? router.query.code : '';

      if (authCode) {
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
          await router.push('/');
          pushNotification('info', SYSTEM_USE_NOTIFICATION_TEXT);
        } catch (e) {
          console.log(e);
          signIn();
          return;
        }
      }
    };

    login().catch((e) => console.log(e));
  }, [router, signIn]);

  return (
    <div>
      <h1>
        {commonLabels.loginLabel}
        <span aria-live="polite" aria-label={commonLabels.loginLabel}>
          <Spinner size="large" />
        </span>
      </h1>
    </div>
  );
}
