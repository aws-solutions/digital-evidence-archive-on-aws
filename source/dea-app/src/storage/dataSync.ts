/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DataSyncClient } from '@aws-sdk/client-datasync';
import { getRequiredEnv } from '../lambda-http-helpers';

const region = process.env.AWS_REGION ?? 'us-east-1';

export interface DataSyncProvider {
  dataSyncClient: DataSyncClient;
  dataSyncRoleArn: string;
  datasetsBucketArn: string;
}

export const defaultDataSyncProvider = {
  dataSyncClient: new DataSyncClient({ region }),
  dataSyncRoleArn: getRequiredEnv('DATASYNC_ROLE', 'DATASYNC_ROLE is not set in your lambda!'),
  datasetsBucketArn: `arn:aws:s3:::${getRequiredEnv(
    'DATASETS_BUCKET_NAME',
    'DATASETS_BUCKET_NAME is not set in your lambda!'
  )}`,
};
