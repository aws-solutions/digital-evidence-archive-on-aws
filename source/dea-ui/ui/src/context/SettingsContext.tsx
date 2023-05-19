/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Context, createContext, useContext, useMemo, useState } from 'react';
import { IAppSettings, defaultAppSettings } from '../models/AppSettings';

export interface ISettingsProps {
  settings: IAppSettings;
  reload: () => void;
}

const SettingsContext: Context<ISettingsProps> = createContext<ISettingsProps>({
  settings: defaultAppSettings,
  reload: () => {
    /*do nothing*/
  },
});

export function SettingsProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [settings] = useState<IAppSettings>(defaultAppSettings);

  const props = useMemo(
    () => ({
      settings,
      reload: () => {
        /*do nothing*/
      },
    }),
    [settings]
  );
  return <SettingsContext.Provider value={props}>{children}</SettingsContext.Provider>;
}

export function useSettings(): ISettingsProps {
  return useContext(SettingsContext);
}
