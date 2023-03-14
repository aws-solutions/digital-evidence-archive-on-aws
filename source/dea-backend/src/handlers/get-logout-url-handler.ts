/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getLogoutUrl } from '@aws/dea-app';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

const noOpPreExecution = async () => {
  /* do nothing */
};
export const handler = createDeaHandler(getLogoutUrl, NO_ACL, noOpPreExecution);
