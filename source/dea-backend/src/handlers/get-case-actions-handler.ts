/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getCaseActions } from '@aws/dea-app/lib/app/resources/get-case-actions';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getCaseActions, NO_ACL);
