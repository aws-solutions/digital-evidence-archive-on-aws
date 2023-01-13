/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

function getConstants(): {
  STAGE: string;
  STACK_NAME: string;
  SC_PORTFOLIO_NAME: string;
  AWS_REGION: string;
  SSM_DOC_OUTPUT_KEY_SUFFIX: string;
  S3_ACCESS_LOGS_BUCKET_NAME_OUTPUT_KEY: string;
  S3_ACCESS_BUCKET_PREFIX: string;
  S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY: string;
  S3_DATASETS_BUCKET_ARN_OUTPUT_KEY: string;
  S3_ARTIFACT_BUCKET_SC_PREFIX: string;
  S3_ARTIFACT_BUCKET_BOOTSTRAP_PREFIX: string;
  LAUNCH_CONSTRAINT_ROLE_OUTPUT_KEY: string;
  AMI_IDS_TO_SHARE: string;
  ROOT_USER_EMAIL: string;
  USER_POOL_CLIENT_NAME: string;
  USER_POOL_NAME: string;
  STATUS_HANDLER_ARN_OUTPUT_KEY: string;
  ALLOWED_ORIGINS: string;
  AWS_REGION_SHORT_NAME: string;
  UI_CLIENT_URL: string;
  COGNITO_DOMAIN: string;
  WEBSITE_URLS: string[];
  USER_POOL_ID: string;
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  ID_POOL_ID: string;
  MAIN_ACCT_ENCRYPTION_KEY_ARN_OUTPUT_KEY: string;
  IS_TESTING_ENV: boolean;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = yaml.load(
      // __dirname is a variable that reference the current directory. We use it so we can dynamically navigate to the
      // correct file
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.readFileSync(join(__dirname, `../src/config/${process.env.STAGE}.yaml`), 'utf8') // nosemgrep
    );

    const STACK_NAME = `DeaBackendStack`;
    const SC_PORTFOLIO_NAME = `dea-${config.stage}-${config.awsRegionShortName}`; // Service Catalog Portfolio Name
    const AWS_REGION = config.awsRegion;
    const AWS_REGION_SHORT_NAME = config.awsRegionShortName;
    const S3_ACCESS_BUCKET_PREFIX = 'dea-access-log';
    const S3_ARTIFACT_BUCKET_SC_PREFIX = 'dea-catalog-cfn-templates/';
    const S3_ARTIFACT_BUCKET_BOOTSTRAP_PREFIX = 'environment-files/'; // Location of env bootstrap scripts in the artifacts bucket
    const ROOT_USER_EMAIL = config.rootUserEmail;
    const allowedOrigins: string[] = config.allowedOrigins || [];
    allowedOrigins.push(config.stacks[0].WebsiteURL);
    const USER_POOL_CLIENT_NAME = `dea-client-${config.stage}-${config.awsRegionShortName}`;
    const USER_POOL_NAME = `dea-userpool-${config.stage}-${config.awsRegionShortName}`;
    const COGNITO_DOMAIN = config.cognitoDomain;
    const WEBSITE_URLS = allowedOrigins;
    const USER_POOL_ID = config.userPoolId;
    const CLIENT_ID = config.clientId;
    const CLIENT_SECRET = config.clientSecret;
    const ID_POOL_ID = config.identityPoolId;
    const IS_TESTING_ENV = config.isTestingEnv ?? false;

    const AMI_IDS: string[] = [];

    // These are the OutputKey for the DEA Main Account CFN stack
    const SSM_DOC_OUTPUT_KEY_SUFFIX = 'SSMDocOutput';
    const S3_ACCESS_LOGS_BUCKET_NAME_OUTPUT_KEY = 'S3BucketAccessLogsNameOutput';
    const S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY = 'S3BucketArtifactsArnOutput';
    const S3_DATASETS_BUCKET_ARN_OUTPUT_KEY = 'S3BucketDatasetsArnOutput';
    const LAUNCH_CONSTRAINT_ROLE_OUTPUT_KEY = 'LaunchConstraintIamRoleNameOutput';
    const STATUS_HANDLER_ARN_OUTPUT_KEY = 'StatusHandlerLambdaArnOutput';
    const MAIN_ACCT_ENCRYPTION_KEY_ARN_OUTPUT_KEY = 'MainAccountEncryptionKeyOutput';

    return {
      STAGE: config.stage,
      STACK_NAME,
      SC_PORTFOLIO_NAME,
      AWS_REGION,
      SSM_DOC_OUTPUT_KEY_SUFFIX,
      S3_ACCESS_LOGS_BUCKET_NAME_OUTPUT_KEY,
      S3_ACCESS_BUCKET_PREFIX,
      S3_ARTIFACT_BUCKET_ARN_OUTPUT_KEY,
      S3_DATASETS_BUCKET_ARN_OUTPUT_KEY,
      S3_ARTIFACT_BUCKET_SC_PREFIX,
      S3_ARTIFACT_BUCKET_BOOTSTRAP_PREFIX,
      LAUNCH_CONSTRAINT_ROLE_OUTPUT_KEY,
      AMI_IDS_TO_SHARE: JSON.stringify(AMI_IDS),
      ROOT_USER_EMAIL,
      USER_POOL_CLIENT_NAME,
      USER_POOL_NAME,
      ALLOWED_ORIGINS: JSON.stringify(allowedOrigins),
      AWS_REGION_SHORT_NAME: AWS_REGION_SHORT_NAME,
      UI_CLIENT_URL: config.stacks[0].WebsiteURL,
      STATUS_HANDLER_ARN_OUTPUT_KEY,
      COGNITO_DOMAIN,
      WEBSITE_URLS,
      USER_POOL_ID,
      CLIENT_ID,
      CLIENT_SECRET,
      ID_POOL_ID,
      MAIN_ACCT_ENCRYPTION_KEY_ARN_OUTPUT_KEY,
      IS_TESTING_ENV,
    };
  } catch (err) {
    throw new Error(`Failed to load configuration: ${err}`);
  }
}

export { getConstants };
