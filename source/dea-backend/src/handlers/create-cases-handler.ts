/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createCases } from '@aws/dea-app';
import { createDeaHandler } from './create-dea-handler';

exports.handler = createDeaHandler(createCases);