/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getAvailableEndpointsForUser } from '@aws/dea-app/lib/app/resources/get-available-endpoints';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getAvailableEndpointsForUser, NO_ACL);
