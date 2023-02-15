/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction, createCaseMembership } from '@aws/dea-app';
import { createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(createCaseMembership, [CaseAction.INVITE]);
