/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { sayBye } from '@aws/dea-app';
import { createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(sayBye);
