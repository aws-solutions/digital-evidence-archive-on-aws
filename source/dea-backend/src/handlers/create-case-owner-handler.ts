/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createCaseOwner } from '@aws/dea-app/lib/app/resources/create-case-owner';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(createCaseOwner, NO_ACL);
