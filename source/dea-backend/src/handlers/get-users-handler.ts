/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getUsers } from '@aws/dea-app/lib/app/resources/get-users';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getUsers, NO_ACL);
