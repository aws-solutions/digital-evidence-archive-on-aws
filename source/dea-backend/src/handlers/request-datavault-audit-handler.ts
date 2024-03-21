/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { startDataVaultAudit } from '@aws/dea-app/lib/app/resources/audit/start-datavault-audit';
import { NO_ACL, createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(startDataVaultAudit, NO_ACL);
