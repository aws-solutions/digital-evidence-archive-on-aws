/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { startDataVaultFileAudit } from '@aws/dea-app/lib/app/resources/audit/start-datavault-file-audit';
import { NO_ACL, createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(startDataVaultFileAudit, NO_ACL);
