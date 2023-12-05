/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { calculateIncrementalChecksum } from '@aws/dea-app/lib/app/event-handlers/calculate-incremental-checksum';

export const handler = calculateIncrementalChecksum;
