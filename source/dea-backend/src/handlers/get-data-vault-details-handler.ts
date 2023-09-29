/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDataVault } from '@aws/dea-app/lib/app/resources/get-data-vault-details';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getDataVault, NO_ACL);
