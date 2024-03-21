/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { startSystemAudit } from '@aws/dea-app/lib/app/resources/audit/start-system-audit';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(startSystemAudit, NO_ACL);
