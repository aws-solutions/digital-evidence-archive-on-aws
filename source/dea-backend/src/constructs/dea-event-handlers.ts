/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { Duration } from 'aws-cdk-lib';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { createCfnOutput } from './construct-support';

interface LambdaEnvironment {
  [key: string]: string;
}

interface DeaEventHandlerProps {
  deaTableArn: string;
  deaDatasetsBucketArn: string;
  lambdaEnv: LambdaEnvironment;
  kmsKey: Key;
}

export class DeaEventHandlers extends Construct {
  public lambdaBaseRole: Role;
  public s3BatchDeleteCaseFileLambda: NodejsFunction;
  public s3BatchDeleteCaseFileRole: Role;

  public constructor(scope: Construct, stackName: string, props: DeaEventHandlerProps) {
    super(scope, stackName);

    this.lambdaBaseRole = this._createLambdaBaseRole(
      props.deaTableArn,
      props.deaDatasetsBucketArn,
      props.kmsKey.keyArn
    );

    this.s3BatchDeleteCaseFileLambda = this._createLambda(
      `s3_batch_delete_case_file`,
      '../../src/handlers/s3-batch-delete-case-file-handler.ts',
      props.lambdaEnv
    );

    this.s3BatchDeleteCaseFileRole = this._createS3BatchRole(props.deaDatasetsBucketArn);
  }

  private _createLambda(id: string, pathToSource: string, lambdaEnv: LambdaEnvironment): NodejsFunction {
    const lambda = new NodejsFunction(this, id, {
      memorySize: 512,
      role: this.lambdaBaseRole,
      timeout: Duration.seconds(60),
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, pathToSource),
      depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        STAGE: deaConfig.stage(),
        ...lambdaEnv,
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    createCfnOutput(this, 'S3BatchDeleteCaseFileLambda', {
      value: lambda.functionArn,
    });

    return lambda;
  }

  private _createS3BatchRole(datasetsBucketArn: string): Role {
    const role = new Role(this, 's3-batch-delete-case-file-role', {
      assumedBy: new ServicePrincipal('batchoperations.s3.amazonaws.com'),
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject'],
        resources: [`${datasetsBucketArn}/manifests/*`, `${datasetsBucketArn}/reports/*`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [this.s3BatchDeleteCaseFileLambda.functionArn],
      })
    );

    return role;
  }

  private _createLambdaBaseRole(tableArn: string, datasetsBucketArn: string, kmsKeyArn: string): Role {
    const basicExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole'
    );
    const role = new Role(this, 'dea-base-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [basicExecutionPolicy],
    });

    role.addToPolicy(
      new PolicyStatement({
        // NOTE: REJECT PR IF WILDCARD NOT REMOVED
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:Query',
          'dynamodb:UpdateItem',
          'dynamodb:*',
        ],
        resources: [tableArn, `${tableArn}/index/GSI1`, `${tableArn}/index/GSI2`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: [
          's3:DeleteObject',
          's3:DeleteObjectVersion',
          's3:GetObjectLegalHold',
          's3:PutObjectLegalHold',
          // NOTE: REJECT PR IF WILDCARD NOT REMOVED
          's3:*',
        ],
        resources: [`${datasetsBucketArn}/*`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [kmsKeyArn],
      })
    );

    return role;
  }
}
