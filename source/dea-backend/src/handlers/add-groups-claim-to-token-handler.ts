/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { addGroupsClaimToToken } from '@aws/dea-app/lib/app/event-handlers/pretoken-generation-trigger';

export const handler = addGroupsClaimToToken;
