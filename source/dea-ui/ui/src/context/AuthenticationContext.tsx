/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { useRouter, usePathname } from 'next/navigation';
import pkceChallenge from 'pkce-challenge';
import { Context, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getLoginUrl } from '../api/auth';
import { getCallbackUrl, signOutProcess } from '../helpers/authService';
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
  const pathname = usePathname();

  useEffect(() => {
    const checkLogin = async () => {
      // Check if the current route is `/login`
      if (pathname === '/login' || pathname === '/auth-test') {
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
  }, [pathname]);

  const signIn = async (): Promise<void> => {
    try {
      const callbackUrl = getCallbackUrl();
      let loginUrl = await getLoginUrl(callbackUrl);

      // Create PKCE challenge and include code challenge and code challenge method in oauth2/authorize
      const challenge = pkceChallenge(128);
      sessionStorage.setItem('pkceVerifier', challenge.code_verifier);
      loginUrl += `&code_challenge=${challenge.code_challenge}&code_challenge_method=S256`;
      router.push(loginUrl);
    } catch (e) {
      console.log(e);
    }
  };
  const signOut = async (): Promise<void> => {
    const logoutUrl = await signOutProcess();
    setUser(unknownUser);
    router.push(logoutUrl);
  };

  const isLoggedIn = user !== unknownUser;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const props = useMemo(() => ({ user, signIn, signOut, isLoggedIn }), [user, isLoggedIn]);
  return <AuthenticationContext.Provider value={props}>{children}</AuthenticationContext.Provider>;
}

export function useAuthentication(): IAuthenticationProps {
  return useContext(AuthenticationContext);
}
