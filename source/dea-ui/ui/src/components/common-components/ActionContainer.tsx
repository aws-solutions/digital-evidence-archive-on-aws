/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
export interface ActionsProps {
  required: string;
  actions: string[];
  children?: React.ReactNode;
}

export default function ActionContainer({ required, actions, children }: ActionsProps) {
  const isAllowedTo = (action: string): boolean => {
    return actions.includes(action);
  };

  if (isAllowedTo(required)) {
    return <>{children}</>;
  }

  return <></>;
}
