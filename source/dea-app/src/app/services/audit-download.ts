/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AssumeRoleCommand, STSClient } from '@aws-sdk/client-sts';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Aws } from 'aws-cdk-lib';
import { getCustomUserAgent, getRequiredEnv } from '../../lambda-http-helpers';
import { logger } from '../../logger';

export async function getAuditDownloadPresignedUrl(
  bucketName: string,
  objectKey: string,
  sourceIp: string
): Promise<string> {
  const sourceIpValidationEnabled = getRequiredEnv('SOURCE_IP_VALIDATION_ENABLED', 'true') === 'true';
  const auditDownloadRoleArn = getRequiredEnv('AUDIT_DOWNLOAD_ROLE_ARN');
  const region = getRequiredEnv('AWS_REGION');
  const keyArn = getRequiredEnv('KEY_ARN');
  const auditDownloadExpirySeconds =
    Number.parseInt(getRequiredEnv('AUDIT_DOWNLOAD_FILES_TIMEOUT_MINUTES', '60')) * 60;

  const client = new STSClient({ region, customUserAgent: getCustomUserAgent() });
  const downloadPolicy = getPolicyForDownload(
    bucketName,
    objectKey,
    sourceIp,
    sourceIpValidationEnabled,
    keyArn
  );
  const credentials = (
    await client.send(
      new AssumeRoleCommand({
        RoleArn: auditDownloadRoleArn,
        RoleSessionName: objectKey.replace('/', '-'),
        DurationSeconds: auditDownloadExpirySeconds,
        Policy: downloadPolicy,
      })
    )
  ).Credentials;

  if (!credentials || !credentials.SecretAccessKey || !credentials.AccessKeyId) {
    logger.error('Failed to assume download role', { auditDownloadRoleArn });
    throw new Error('Failed to assume role');
  }

  const presignedUrlS3Client = new S3Client({
    region,
    customUserAgent: getCustomUserAgent(),
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
      expiration: credentials.Expiration,
    },
  });

  const downloadDate = new Date();
  const getObjectCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    ResponseContentType: 'text/csv',
    ResponseContentDisposition: `attachment; filename="AuditResult_${downloadDate.getFullYear()}_${
      downloadDate.getMonth() + 1
    }_${downloadDate.getDate()}_H${downloadDate.getHours()}.csv"`,
  });
  return await getSignedUrl(presignedUrlS3Client, getObjectCommand, {
    expiresIn: auditDownloadExpirySeconds,
  });
}

function getPolicyForDownload(
  bucketName: string,
  objectKey: string,
  sourceIp: string,
  sourceIpValidationEnabled: boolean,
  keyArn: string
): string {
  if (!sourceIpValidationEnabled) {
    logger.info('Not restricting presigned-url by source ip');
    return JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowS3GetObject',
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:GetObjectVersion'],
          Resource: [`arn:${Aws.PARTITION}:s3:::${bucketName}/${objectKey}`],
        },
        {
          Sid: 'AllowDecrypt',
          Effect: 'Allow',
          Action: ['kms:Decrypt', 'kms:GenerateDataKey'],
          Resource: [keyArn],
        },
      ],
    });
  }
  logger.info('Restricting presigned-url by source ip', { sourceIp });
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'AllowS3GetObject',
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:GetObjectVersion'],
        Resource: [`arn:${Aws.PARTITION}:s3:::${bucketName}/${objectKey}`],
        Condition: {
          IpAddress: {
            'aws:SourceIp': sourceIp,
          },
        },
      },
      {
        Sid: 'DenyRequestsFromOtherIpAddresses',
        Effect: 'Deny',
        Action: ['s3:GetObject', 's3:GetObjectVersion'],
        Resource: [`arn:${Aws.PARTITION}:s3:::${bucketName}/${objectKey}`],
        Condition: {
          NotIpAddress: {
            'aws:SourceIp': sourceIp,
          },
        },
      },
      {
        Sid: 'AllowDecrypt',
        Effect: 'Allow',
        Action: ['kms:Decrypt', 'kms:GenerateDataKey'],
        Resource: [keyArn],
      },
      {
        Sid: 'DenyKeyRequestsFromOtherIpAddresses',
        Effect: 'Deny',
        Action: ['kms:Decrypt', 'kms:GenerateDataKey'],
        Resource: [keyArn],
        Condition: {
          NotIpAddress: {
            'aws:SourceIp': sourceIp,
          },
        },
      },
    ],
  });
}
