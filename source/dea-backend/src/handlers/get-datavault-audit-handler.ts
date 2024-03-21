/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDataVaultAudit } from '@aws/dea-app/lib/app/resources/audit/get-datavault-audit';
import { NO_ACL, createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(getDataVaultAudit, NO_ACL);
