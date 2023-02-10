/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { updateCases } from '@aws/dea-app';
import { createDeaHandler } from './create-dea-handler';

export const handler = createDeaHandler(updateCases);
