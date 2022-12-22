/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

function getConstants(): {
  STAGE: string;
  API_BASE_URL: string;
  AWS_REGION: string;
  STACK_NAME: string;
  S3_ACCESS_LOGS_BUCKET_PREFIX: string;
  S3_ACCESS_LOGS_BUCKET_NAME_OUTPUT_KEY: string;
  S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY: string;
  S3_ARTIFACT_BUCKET_NAME: string;
  S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME: string;
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = yaml.load(
    // __dirname is a variable that reference the current directory. We use it so we can dynamically navigate to the
    // correct file
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.readFileSync(join(__dirname, `../../../dea-backend/src/config/${process.env.STAGE}.yaml`), 'utf8') // nosemgrep
  );
  const STAGE = process.env.STAGE || '';
  const namePrefix = `DeaUiStack`;
  const API_BASE_URL = config.apiUrlOutput?.replace('/dev/', '') || '';
  const AWS_REGION = config.awsRegion;
  const STACK_NAME = namePrefix;
  const S3_ARTIFACT_BUCKET_NAME = `${namePrefix}-bucket`;
  const S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME = `${namePrefix}-deployment-bucket`;
  const S3_ACCESS_LOGS_BUCKET_PREFIX = 'dea-access-log';

  // CloudFormation Output Keys
  const S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY = 'S3BucketArtifactsArnOutput';
  const S3_ACCESS_LOGS_BUCKET_NAME_OUTPUT_KEY = 'S3BucketAccessLogsNameOutput';

  return {
    STAGE,
    API_BASE_URL,
    AWS_REGION,
    STACK_NAME,
    S3_ACCESS_LOGS_BUCKET_PREFIX,
    S3_ACCESS_LOGS_BUCKET_NAME_OUTPUT_KEY,
    S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY,
    S3_ARTIFACT_BUCKET_NAME,
    S3_ARTIFACT_BUCKET_DEPLOYMENT_NAME,
  };
}

export { getConstants };
