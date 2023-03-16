/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { RevokeToken } from '@aws/dea-app/lib/models/auth';
import jwt from 'jwt-decode';
import { useRouter } from 'next/router';
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
        const loginUrl = await getLoginUrl();
        await router.push(loginUrl);
      }
    };
    checkLogin().catch((e) => console.log(e));
  }, [router]);

  const signIn = (user: IUser): void => setUser(user);
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
    setUser(unknownUser);

    // Redirect to login page
    const logoutUrl = await getLogoutUrl();
    await router.push(logoutUrl);
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
