/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createDataVault } from '@aws/dea-app/lib/app/resources/create-data-vault';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(createDataVault, NO_ACL);
