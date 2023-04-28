/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { s3BatchJobStatusChangeHandler } from '@aws/dea-app/lib/storage/s3-batch-job-status-change-handler';

export const handler = s3BatchJobStatusChangeHandler;
