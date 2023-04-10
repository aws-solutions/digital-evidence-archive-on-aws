/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { useRouter } from 'next/router';
import pkceChallenge from 'pkce-challenge';
import { Context, createContext, useContext, useEffect, useState } from 'react';
import { getLoginUrl, getLogoutUrl, revokeToken } from '../api/auth';
import { IUser, unknownUser } from '../models/User';

export interface IAuthenticationProps {
  user: IUser;
  signIn: () => void;
  signOut: () => void;
  isLoggedIn: boolean;
}

const AuthenticationContext: Context<IAuthenticationProps> = createContext<IAuthenticationProps>({
  user: unknownUser,
  signIn: (/*user: IUser*/) => {
    /*do nothing*/
  },
  signOut: () => {
    /*do nothing*/
  },
  isLoggedIn: false,
});

export function AuthenticationProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<IUser>(unknownUser);
  const router = useRouter();

  useEffect(() => {
    const checkLogin = async () => {
      // Check if the current route is `/login`
      if (router.pathname === '/login' || router.pathname === '/auth-test') {
        return;
      }

      const accessKeyId = sessionStorage.getItem('accessKeyId');
      const secretAccessKey = sessionStorage.getItem('secretAccessKey');
      const sessionToken = sessionStorage.getItem('sessionToken');
      const username = localStorage.getItem('username');

      if (accessKeyId && secretAccessKey && sessionToken && username) {
        setUser({ username });
      } else {
        // Not logged in, redirect to login page
        await signIn();
      }
    };
    checkLogin().catch((e) => console.log(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const signIn = async (): Promise<void> => {
    try {
      const callbackUrl = getCallbackUrl();
      let loginUrl = await getLoginUrl(callbackUrl);

      // Create PKCE challenge and include code challenge and code challenge method in oauth2/authorize
      const challenge = pkceChallenge(128);
      sessionStorage.setItem('pkceVerifier', challenge.code_verifier);
      loginUrl += `&code_challenge=${challenge.code_challenge}&code_challenge_method=S256`;
      await router.push(loginUrl);
    } catch (e) {
      console.log(e);
    }
  };
  const signOut = async (): Promise<void> => {
    try {
      await revokeToken();
    } catch (e) {
      console.log('Error revoking token, refresh token may be expired already:', e);
    }

    clearStorage();
    setUser(unknownUser);

    // Logout of cognito session and redirect to login page
    const callbackUrl = getCallbackUrl();
    const logoutUrl = await getLogoutUrl(callbackUrl);
    await router.push(logoutUrl);
  };

  function clearStorage() {
    sessionStorage.removeItem('accessKeyId');
    sessionStorage.removeItem('secretAccessKey');
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('pkceVerifier');
    localStorage.removeItem('username');
  }

  function getCallbackUrl() {
    let callbackUrl = '';
    if (typeof window !== 'undefined') {
      callbackUrl = `${window.location}`.replace(/\/ui(.*)/, '/ui/login');
    }
    return callbackUrl;
  }

  const isLoggedIn = user !== unknownUser;

  return (
    <AuthenticationContext.Provider value={{ user, signIn, signOut, isLoggedIn }}>
      {children}
    </AuthenticationContext.Provider>
  );
}

export function useAuthentication(): IAuthenticationProps {
  return useContext(AuthenticationContext);
}
