/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getCredentials } from '@aws/dea-app/lib/app/resources/get-credentials';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

const noOpPreExecution = async () => {
  /* do nothing */
};
export const handler = createDeaHandler(getCredentials, NO_ACL, noOpPreExecution);
