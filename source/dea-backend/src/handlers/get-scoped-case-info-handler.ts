/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getScopedCaseInformation } from '@aws/dea-app/lib/app/resources/get-scoped-case-information';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(getScopedCaseInformation, NO_ACL);
