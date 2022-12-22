/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { deleteCase } from '@aws/dea-app';
import { createDeaHandler } from './create-dea-handler';

exports.handler = createDeaHandler(deleteCase);
