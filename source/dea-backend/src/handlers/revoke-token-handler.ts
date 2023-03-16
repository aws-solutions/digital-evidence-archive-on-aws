/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { revokeToken } from '@aws/dea-app/lib/app/resources/revoke-token';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(revokeToken, NO_ACL);
