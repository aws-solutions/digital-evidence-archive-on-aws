/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AppLayoutProps } from '@cloudscape-design/components';
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  ReactNode,
  Context,
  useMemo,
} from 'react';
import { IAppHelpState } from '../models/AppHelp';

export interface IHelpProps {
  state: IAppHelpState;
  makeHelpPanelHandler: (topic: string) => () => void;
  setToolsOpen: (toolsOpen: boolean) => void;
  setHelpPanelTopic: (helpPanelTopic: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appLayoutRef?: any;
}

const defaultAppHelp: IHelpProps = {
  state: {
    toolsOpen: false,
    helpPanelTopic: 'default',
  },
  makeHelpPanelHandler: () => () => {
    /* do nothing */
  },
  setToolsOpen: () => {
    /* do nothing */
  },
  setHelpPanelTopic: () => {
    /* do nothing */
  },
};

const HelpContext: Context<IHelpProps> = createContext<IHelpProps>(defaultAppHelp);

export function HelpProvider({ children }: { children: ReactNode }): JSX.Element {
  const [help, setHelp] = useState<IAppHelpState>(defaultAppHelp.state);
  const appLayoutRef = useRef<AppLayoutProps.Ref>(null);

  const makeHelpPanelHandler = useCallback(
    (topic) => () => {
      setHelp((prevStore) => ({
        ...prevStore,
        toolsOpen: true,
        helpPanelTopic: topic,
      }));
      appLayoutRef.current?.focusToolsClose();
    },
    []
  );

  const setToolsOpen = (toolsOpen: boolean) => {
    setHelp((prevStore) => ({ ...prevStore, toolsOpen: toolsOpen }));
  };

  const setHelpPanelTopic = useCallback((helpPanelTopic: string) => {
    setHelp((prevStore) => ({ ...prevStore, helpPanelTopic: helpPanelTopic }));
  }, []);

  const props = useMemo(
    () => ({
      state: help,
      makeHelpPanelHandler,
      setToolsOpen,
      setHelpPanelTopic,
      appLayoutRef,
    }),
    [help, makeHelpPanelHandler, setHelpPanelTopic]
  );

  return <HelpContext.Provider value={props}>{children}</HelpContext.Provider>;
}

export function useHelp() {
  return useContext(HelpContext);
}
