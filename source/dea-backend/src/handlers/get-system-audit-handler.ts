/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getSystemAudit } from '@aws/dea-app/lib/app/resources/get-system-audit';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getSystemAudit, NO_ACL);
