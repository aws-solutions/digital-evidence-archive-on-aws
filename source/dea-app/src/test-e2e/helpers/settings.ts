/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

const throwUnset = (varName: string) => {
  throw new Error(`Required ENV ${varName} is not set.`);
};

export const testEnv = {
  stage: process.env.STAGE ?? 'devsample',
  awsRegion: process.env.AWS_REGION ?? 'us-east-1',
  domainName: process.env.DOMAIN_PREFIX ?? throwUnset('DOMAIN_PREFIX'),
  apiUrlOutput: process.env.DEA_API_URL ?? throwUnset('DEA_API_URL'),
  identityPoolId: process.env.IDENTITY_POOL_ID ?? throwUnset('IDENTITY_POOL_ID'),
  userPoolId: process.env.USER_POOL_ID ?? throwUnset('USER_POOL_ID'),
  clientId: process.env.USER_POOL_CLIENT_ID ?? throwUnset('USER_POOL_CLIENT_ID'),
  datasetsBucketName: process.env.DATASETS_BUCKET_NAME ?? throwUnset('DATASETS_BUCKET_NAME'),
  auditBucketName: process.env.AUDIT_BUCKET_NAME ?? throwUnset('AUDIT_BUCKET_NAME'),
  glueDBName: process.env.GLUE_DB ?? throwUnset('GLUE_DB'),
  glueTableName: process.env.GLUE_TABLE ?? throwUnset('GLUE_TABLE'),
  athenaWorkgroupName: process.env.ATHENA_WORKGROUP_NAME ?? throwUnset('ATHENA_WORKGROUP_NAME'),
  DataSyncRole: process.env.DATASYNC_ROLE ?? throwUnset('DATASYNC_ROLE'),
  DataSyncReportsRole: process.env.DATASYNC_REPORTS_ROLE ?? throwUnset('DATASYNC_REPORTS_ROLE'),
  DataSyncReportsBucket:
    process.env.DATASYNC_REPORTS_BUCKET_NAME ?? throwUnset('DATASYNC_REPORTS_BUCKET_NAME'),
  fipsSupported: process.env.FIPS_SUPPORTED === 'true' ?? throwUnset('FIPS_SUPPORTED'),
};
