/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDataVaults } from '@aws/dea-app/lib/app/resources/get-data-vaults';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getDataVaults, NO_ACL);
