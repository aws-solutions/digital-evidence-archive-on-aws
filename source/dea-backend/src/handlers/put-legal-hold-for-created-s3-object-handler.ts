/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { putLegalHoldForCreatedS3Object } from '@aws/dea-app/lib/app/event-handlers/put-legal-hold-for-created-s3-object';

export const handler = putLegalHoldForCreatedS3Object;
