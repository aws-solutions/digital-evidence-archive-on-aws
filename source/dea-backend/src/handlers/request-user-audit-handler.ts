/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { startUserAudit } from '@aws/dea-app/lib/app/resources/audit/start-user-audit';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(startUserAudit, NO_ACL);
