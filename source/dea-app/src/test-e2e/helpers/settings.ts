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
};
