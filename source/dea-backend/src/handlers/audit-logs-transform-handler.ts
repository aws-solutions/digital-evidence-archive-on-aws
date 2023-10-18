/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { transformAuditEventForS3 } from '@aws/dea-app/lib/app/transform/audit-logs-to-s3-transformation-handler';

export const handler = transformAuditEventForS3;
