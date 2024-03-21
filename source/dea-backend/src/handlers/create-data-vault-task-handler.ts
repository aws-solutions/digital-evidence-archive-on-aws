/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createDataVaultTask } from '@aws/dea-app/lib/app/resources/create-data-vault-task';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(createDataVaultTask, NO_ACL);
