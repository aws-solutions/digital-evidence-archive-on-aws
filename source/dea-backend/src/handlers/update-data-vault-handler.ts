/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { updateDataVault } from '@aws/dea-app/lib/app/resources/update-data-vault';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(updateDataVault, NO_ACL);
