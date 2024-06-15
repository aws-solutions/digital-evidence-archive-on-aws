/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DataSyncClient } from '@aws-sdk/client-datasync';
import { getCustomUserAgent, getRequiredEnv } from '../lambda-http-helpers';

const region = getRequiredEnv('AWS_REGION', 'us-east-1');
const fipsSupported = getRequiredEnv('AWS_USE_FIPS_ENDPOINT', 'false') === 'true';

export interface DataSyncProvider {
  dataSyncClient: DataSyncClient;
  dataSyncRoleArn: string;
  datasetsBucketName: string;
  datasetsBucketArn: string;
  dataSyncReportsRoleArn: string;
  dataSyncReportsBucketArn: string;
}

const partition = region.includes('us-gov') ? 'aws-us-gov' : 'aws';

export const defaultDataSyncProvider: DataSyncProvider = {
  dataSyncClient: new DataSyncClient({
    region,
    customUserAgent: getCustomUserAgent(),
    useFipsEndpoint: fipsSupported,
  }),
  dataSyncRoleArn: getRequiredEnv('DATASYNC_ROLE', 'DATASYNC_ROLE is not set in your lambda!'),
  datasetsBucketName: getRequiredEnv(
    'DATASETS_BUCKET_NAME',
    'DATASETS_BUCKET_NAME is not set in your lambda!'
  ),
  datasetsBucketArn: `arn:${partition}:s3:::${getRequiredEnv(
    'DATASETS_BUCKET_NAME',
    'DATASETS_BUCKET_NAME is not set in your lambda!'
  )}`,
  dataSyncReportsRoleArn: getRequiredEnv(
    'DATASYNC_REPORTS_ROLE',
    'DATASYNC_LOGS_ROLE is not set in your lambda!'
  ),
  dataSyncReportsBucketArn: `arn:${partition}:s3:::${getRequiredEnv(
    'DATASYNC_REPORTS_BUCKET_NAME',
    'DATASYNC_REPORTS_BUCKET_NAME is not set in your lambda!'
  )}`,
};
