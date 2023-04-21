/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { refreshToken } from '@aws/dea-app/lib/app/resources/refresh-token';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

const noOpPreExecution = async () => {
  /* do nothing */
};
export const handler = createDeaHandler(refreshToken, NO_ACL, noOpPreExecution);
