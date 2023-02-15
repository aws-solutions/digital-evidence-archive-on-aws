/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getToken } from '@aws/dea-app';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

const noOpPreExecution = () => {
  /* do nothing */
  return Promise.resolve();
};
export const handler = createDeaHandler(getToken, NO_ACL, noOpPreExecution);