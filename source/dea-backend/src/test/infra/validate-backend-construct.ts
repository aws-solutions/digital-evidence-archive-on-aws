/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Match, Template } from 'aws-cdk-lib/assertions';

export const validateBackendConstruct = (template: Template): void => {
  //the rest api construct
  template.hasResourceProperties('AWS::ApiGateway::RestApi', {
    Description: 'Backend API',
  });

  //the backend construct
  template.hasResourceProperties('AWS::DynamoDB::Table', {
    TableName: 'DeaTable',
    KeySchema: Match.arrayWith([
      Match.objectLike({
        AttributeName: 'PK',
        KeyType: 'HASH',
      }),
      Match.objectLike({
        AttributeName: 'SK',
        KeyType: 'RANGE',
      }),
    ]),
    GlobalSecondaryIndexes: Match.arrayWith([
      Match.objectLike({
        IndexName: 'GSI1',
      }),
      Match.objectLike({
        IndexName: 'GSI2',
      }),
    ]),
  });

  // make sure all s3 buckets are created with public access disabled
  template.allResourcesProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });

  // validate datasets S3 bucket properties
  template.hasResourceProperties('AWS::S3::Bucket', {
    VersioningConfiguration: Match.objectLike({
      Status: "Enabled"
    }),
    ObjectLockEnabled: true,
    LifecycleConfiguration: Match.objectLike({
      Rules: Match.arrayWith([
        Match.objectLike({
          AbortIncompleteMultipartUpload: {
            DaysAfterInitiation: 1
          },
          Id: "DeaDatasetsDeleteIncompleteUploadsLifecyclePolicy",
          Status: "Enabled"
        })
      ])
    })
  });
};
