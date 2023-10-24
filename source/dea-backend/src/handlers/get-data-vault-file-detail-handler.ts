/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDataVaultFileDetails } from '@aws/dea-app/lib/app/resources/get-data-vault-file-details';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getDataVaultFileDetails, NO_ACL);
