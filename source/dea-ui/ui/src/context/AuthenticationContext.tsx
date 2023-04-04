/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { RevokeToken } from '@aws/dea-app/lib/models/auth';
import jwt from 'jwt-decode';
import { useRouter } from 'next/router';
import pkceChallenge from 'pkce-challenge';
import { createContext, useContext, Context, useState, useEffect } from 'react';
import { getLoginUrl, getLogoutUrl, revokeToken } from '../api/auth';
import { IUser, unknownUser } from '../models/User';

export interface IAuthenticationProps {
  user: IUser;
  signIn: (user: IUser) => void;
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

      const accessKeyId = localStorage.getItem('accessKeyId');
      const secretAccessKey = localStorage.getItem('secretAccessKey');
      const sessionToken = localStorage.getItem('sessionToken');
      const idToken = localStorage.getItem('idToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (accessKeyId && secretAccessKey && sessionToken && idToken && refreshToken) {
        decodeTokenAndSetUser(idToken);
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
      let callbackUrl = '';
      if (typeof window !== 'undefined') {
        callbackUrl = `${window.location}`.replace(/\/ui(.*)/, '/ui/login');
      }
      let loginUrl = await getLoginUrl(callbackUrl);

      // Create PKCE challenge and include code challenge and code challenge method in oauth2/authorize
      const challenge = pkceChallenge(128);
      localStorage.setItem('pkceVerifier', challenge.code_verifier);
      loginUrl += `&code_challenge=${challenge.code_challenge}&code_challenge_method=S256`;
      await router.push(loginUrl);
    } catch (e) {
      console.log(e);
    }
  };
  const signOut = async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      const payload: RevokeToken = {
        refreshToken: refreshToken,
      };

      await revokeToken(payload);
    }

    localStorage.removeItem('accessKeyId');
    localStorage.removeItem('secretAccessKey');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('idToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('pkceVerifier');
    setUser(unknownUser);

    // Logout of cognito session and redirect to login page
    await getLogoutUrl();
    await signIn();
  };

  function decodeTokenAndSetUser(idToken: string): void {
    const decodedToken: { [id: string]: string | Array<string> } = jwt(String(idToken));
    const cognitoUsername =
      typeof decodedToken['cognito:username'] === 'string' ? decodedToken['cognito:username'] : '';
    setUser({
      username: cognitoUsername,
    });
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
