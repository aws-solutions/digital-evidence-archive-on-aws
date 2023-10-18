/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { listDataVaultFiles } from '@aws/dea-app/lib/app/resources/list-data-vault-files';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(listDataVaultFiles, NO_ACL);
