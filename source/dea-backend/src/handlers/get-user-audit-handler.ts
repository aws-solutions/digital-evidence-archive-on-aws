/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getUserAudit } from '@aws/dea-app/lib/app/resources/get-user-audit';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getUserAudit, NO_ACL);
