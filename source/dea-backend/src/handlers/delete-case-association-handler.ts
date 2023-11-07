/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { deleteCaseAssociation } from '@aws/dea-app/lib/app/resources/delete-case-association';
import { createDeaHandler, NO_ACL } from './create-dea-handler';

export const handler = createDeaHandler(deleteCaseAssociation, NO_ACL);
