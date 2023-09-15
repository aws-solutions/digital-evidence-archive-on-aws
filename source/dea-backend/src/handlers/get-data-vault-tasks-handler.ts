/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDataVaultTasks } from '@aws/dea-app/lib/app/resources/get-data-vault-tasks';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getDataVaultTasks, NO_ACL);
