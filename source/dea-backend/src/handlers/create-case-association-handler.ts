/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { createCaseAssociation } from '@aws/dea-app/lib/app/resources/create-case-association';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(createCaseAssociation, NO_ACL);
