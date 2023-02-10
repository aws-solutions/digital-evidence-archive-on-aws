/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { deleteCase } from '@aws/dea-app';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(deleteCase, NO_ACL);
