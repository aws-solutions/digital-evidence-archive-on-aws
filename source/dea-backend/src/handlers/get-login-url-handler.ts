/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getLoginUrl } from '@aws/dea-app/lib/app/resources/get-login-url';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

const noOpPreExecution = async () => {
  /* do nothing */
};
export const handler = createDeaHandler(getLoginUrl, NO_ACL, noOpPreExecution);
