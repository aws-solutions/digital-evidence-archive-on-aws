/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { restrictAccountStatementStatementProps } from '@aws/dea-app/lib/storage/restrict-account-statement';
import { Aws, CfnResource } from 'aws-cdk-lib';
import { CfnWorkGroup } from 'aws-cdk-lib/aws-athena';
import { ManagedPolicy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import { Key } from 'aws-cdk-lib/aws-kms';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export default function createAuditRedrivePolicy(
  scope: Construct,
  athenaWorkgroup: CfnWorkGroup,
  firehose: CfnDeliveryStream,
  auditLogGroup: LogGroup,
  trailLogGroup: LogGroup,
  queryResultBucket: Bucket,
  auditBucket: Bucket,
  glueDBName: string,
  glueTableName: string,
  kmsKey: Key
): ManagedPolicy {
  const redrivePolicy = new ManagedPolicy(scope, 'AuditRedrivePolicy', {
    description:
      'A Policy which can be attached to an IAM Role, allowing that role to run the Audit Redrive script.',
    statements: [
      new PolicyStatement({
        actions: [
          'cloudformation:ListExports',
          'athena:StartQueryExecution',
          'athena:GetQueryExecution',
          'athena:GetQueryResults',
        ],
        resources: ['*'],
      }),
      new PolicyStatement({
        actions: ['athena:GetWorkgroup'],
        resources: [
          `arn:${Aws.PARTITION}:athena:${Aws.REGION}:${Aws.ACCOUNT_ID}:workgroup/${athenaWorkgroup.name}`,
        ],
      }),
      new PolicyStatement({
        actions: ['firehose:PutRecordBatch'],
        resources: [
          `arn:${Aws.PARTITION}:firehose:${Aws.REGION}:${Aws.ACCOUNT_ID}:deliverystream/${firehose.ref}`,
        ],
      }),
      new PolicyStatement({
        actions: ['logs:DescribeLogStreams', 'logs:GetLogEvents'],
        resources: [auditLogGroup.logGroupArn, trailLogGroup.logGroupArn],
      }),
      new PolicyStatement({
        actions: [
          's3:GetBucketLocation',
          's3:GetObject',
          's3:ListBucket',
          's3:ListBucketMultipartUploads',
          's3:AbortMultipartUpload',
          's3:PutObject',
          's3:ListMultipartUploadParts',
        ],
        resources: [queryResultBucket.bucketArn, `${queryResultBucket.bucketArn}/*`],
      }),
      new PolicyStatement(restrictAccountStatementStatementProps),
      new PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${auditBucket.bucketArn}/*`],
      }),
      new PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [auditBucket.bucketArn],
      }),
      new PolicyStatement({
        actions: ['glue:GetTable', 'glue:GetDatabase'],
        resources: [
          `arn:${Aws.PARTITION}:glue:${Aws.REGION}:${Aws.ACCOUNT_ID}:catalog`,
          `arn:${Aws.PARTITION}:glue:${Aws.REGION}:${Aws.ACCOUNT_ID}:database/${glueDBName}`,
          `arn:${Aws.PARTITION}:glue:${Aws.REGION}:${Aws.ACCOUNT_ID}:table/${glueDBName}/${glueTableName}`,
        ],
      }),
      new PolicyStatement({
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [kmsKey.keyArn],
      }),
    ],
  });

  // CFN NAG Suppression
  const cfnRedrivePolicy = redrivePolicy.node.defaultChild;
  if (cfnRedrivePolicy instanceof CfnResource) {
    cfnRedrivePolicy.addMetadata('cfn_nag', {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      rules_to_suppress: [
        {
          id: 'W13',
          reason: 'Wildcard required as target resources are generated and not pre-existing',
        },
      ],
    });
  }

  return redrivePolicy;
}
