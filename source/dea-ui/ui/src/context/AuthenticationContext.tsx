/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, Context, useState } from 'react';
import { IUser, unknownUser } from '../models/User';

export interface IAuthenticationProps {
  user: IUser;
  signIn: (user: IUser) => void;
  signOut: () => void;
}

const AuthenticationContext: Context<IAuthenticationProps> = createContext<IAuthenticationProps>({
  user: unknownUser,
  signIn: (/*user: IUser*/) => { /*do nothing*/ },
  signOut: () => { /*do nothing*/ },
});

export function AuthenticationProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<IUser>(unknownUser);
  const signIn = (user: IUser): void => setUser(user);
  const signOut = (): void => setUser(unknownUser);

  return (
    <AuthenticationContext.Provider value={{ user, signIn, signOut }}>
      {children}
    </AuthenticationContext.Provider>
  );
}

export function useAuthentication(): IAuthenticationProps {
  return useContext(AuthenticationContext);
}
