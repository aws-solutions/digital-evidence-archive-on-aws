/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Effect, PolicyStatement, Role, AnyPrincipal, ArnPrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Bucket } from 'aws-cdk-lib/aws-s3';

export interface ApplicationResources {
  kmsKey: Key;
  datasetsBucket: Bucket;
  accessLogsBucket: Bucket;
  auditQueryBucket: Bucket;
}

export const restrictResourcePolicies = (
  resources: ApplicationResources,
  customResourceRole: Role,
  applicationAccessRoleArns: string[],
  adminRoleArn: string | undefined,
  endUserUploadRoleArn: string
) => {
  const datasetsObjectActions = [
    's3:AbortMultipartUpload',
    's3:ListMultipartUploadParts',
    's3:PutObject',
    's3:GetObject',
    's3:GetObjectVersion',
    's3:GetObjectLegalHold',
    's3:RestoreObject',
    's3:ListBucket',
    's3:DeleteObject',
    's3:DeleteObjectVersion',
    's3:PutObjectLegalHold',
    's3:ListBucketVersions',
    's3:GetBucketLocation',
    's3:ListBucketMultipartUploads',
    's3:PutObjectTagging',
    's3:GetObjectTagging',
  ];

  const customResourceActions = ['s3:GetBucketCORS', 's3:PutBucketCORS'];

  const rolesForAllow = applicationAccessRoleArns.slice();
  if (adminRoleArn) {
    rolesForAllow.push(adminRoleArn);
  }

  const applicationConditionAllow = {
    StringEquals: {
      'aws:PrincipalArn': rolesForAllow,
    },
  };

  const applicationConditionDeny = {
    StringEquals: {
      'aws:PrincipalArn': applicationAccessRoleArns,
    },
  };

  const notApplicationCondition = {
    StringNotEquals: {
      'aws:PrincipalArn': [...rolesForAllow, endUserUploadRoleArn],
    },
  };

  const customResourceCondition = {
    StringEquals: {
      'aws:PrincipalArn': customResourceRole.roleArn,
    },
  };
  const notCustomResourceCondition = {
    StringNotEquals: {
      'aws:PrincipalArn': customResourceRole.roleArn,
    },
  };

  // DATASETS bucket
  // allow necessary actions on the datasets bucket for the application role
  resources.datasetsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: datasetsObjectActions,
      resources: [`${resources.datasetsBucket.bucketArn}/*`, resources.datasetsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: applicationConditionAllow,
      sid: 'datasets-bucket-policy',
    })
  );

  resources.datasetsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [`s3:PutObject`],
      resources: [`${resources.datasetsBucket.bucketArn}/*`],
      principals: [new ArnPrincipal(endUserUploadRoleArn)],
      sid: 'allow-user-upload',
    })
  );

  resources.datasetsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.DENY,
      notActions: [`s3:PutObject`],
      resources: [`${resources.datasetsBucket.bucketArn}/*`, resources.datasetsBucket.bucketArn],
      principals: [new ArnPrincipal(endUserUploadRoleArn)],
      sid: 'deny-everything-except-upload-for-user',
    })
  );

  // deny everything else on the datasets bucket for the application role
  resources.datasetsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.DENY,
      notActions: datasetsObjectActions,
      resources: [`${resources.datasetsBucket.bucketArn}/*`, resources.datasetsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: applicationConditionDeny,
      sid: 'datasets-deny-bucket-policy',
    })
  );
  // deny dataset actions for everyone else
  resources.datasetsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.DENY,
      actions: datasetsObjectActions,
      resources: [`${resources.datasetsBucket.bucketArn}/*`, resources.datasetsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: notApplicationCondition,
      sid: 'datasets-deny-others-bucket-policy',
    })
  );

  // allow cors actions for the custom resource role
  resources.datasetsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: customResourceActions,
      resources: [`${resources.datasetsBucket.bucketArn}/*`, resources.datasetsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: customResourceCondition,
      sid: 'datasets-custom-resource-policy',
    })
  );
  // deny everything else on the datasets bucket for the custom resource role
  resources.datasetsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.DENY,
      notActions: customResourceActions,
      resources: [`${resources.datasetsBucket.bucketArn}/*`, resources.datasetsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: customResourceCondition,
      sid: 'datasets-deny-non-custom-resource-policy',
    })
  );
  resources.datasetsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.DENY,
      actions: customResourceActions,
      resources: [`${resources.datasetsBucket.bucketArn}/*`, resources.datasetsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: notCustomResourceCondition,
      sid: 'datasets-deny-custom-resource-policy',
    })
  );

  // ACCESS LOGS bucket
  // allow getobject on the access logs bucket for the application role
  resources.accessLogsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:GetObject', 's3:GetObjectVersion'],
      resources: [`${resources.accessLogsBucket.bucketArn}/*`, resources.accessLogsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: applicationConditionAllow,
      sid: 'accesslogs-bucket-policy',
    })
  );
  // deny everything else on the access logs bucket for the application role
  resources.accessLogsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.DENY,
      notActions: ['s3:GetObject', 's3:GetObjectVersion'],
      resources: [`${resources.accessLogsBucket.bucketArn}/*`, resources.accessLogsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: applicationConditionDeny,
      sid: 'accesslogs-deny-other-actions',
    })
  );
  resources.accessLogsBucket.addToResourcePolicy(
    new PolicyStatement({
      effect: Effect.DENY,
      actions: ['s3:GetObject', 's3:GetObjectVersion'],
      resources: [`${resources.accessLogsBucket.bucketArn}/*`, resources.accessLogsBucket.bucketArn],
      principals: [new AnyPrincipal()],
      conditions: notApplicationCondition,
      sid: 'accesslogs-deny-bucket-policy',
    })
  );
};
