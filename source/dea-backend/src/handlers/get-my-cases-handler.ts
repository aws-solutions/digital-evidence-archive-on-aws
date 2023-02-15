/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getMyCases } from '@aws/dea-app';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getMyCases, NO_ACL);
