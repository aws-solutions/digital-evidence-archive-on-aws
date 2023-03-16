/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { Duration } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  AuthorizationType,
  Cors,
  EndpointType,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { ApiGatewayRoute, ApiGatewayRouteConfig } from '../resources/api-gateway-route-config';
import { deaApiRouteConfig } from '../resources/dea-route-config';
import { createCfnOutput } from './construct-support';

interface LambdaEnvironment {
  [key: string]: string;
}
interface DeaRestApiProps {
  deaTableArn: string;
  deaTableName: string;
  deaDatasetsBucketArn: string;
  deaDatasetsBucketName: string;
  kmsKey: Key;
  region: string;
  accountId: string;
  lambdaEnv: LambdaEnvironment;
}

export class DeaRestApiConstruct extends Construct {
  public authLambdaRole: Role;
  public lambdaBaseRole: Role;
  public deaRestApi: RestApi;
  public apiEndpointArns: Map<string, string>;

  public constructor(scope: Construct, stackName: string, props: DeaRestApiProps) {
    super(scope, stackName);

    this.apiEndpointArns = new Map<string, string>();

    this.lambdaBaseRole = this._createLambdaBaseRole(
      props.kmsKey.keyArn,
      props.deaTableArn,
      props.deaDatasetsBucketArn,
      props.region,
      props.accountId
    );

    this.authLambdaRole = this._createAuthLambdaRole(props.region, props.accountId);

    const accessLogGroup = new LogGroup(this, 'APIGatewayAccessLogs', {
      encryptionKey: props.kmsKey,
    });

    const STAGE = deaConfig.stage();

    this.deaRestApi = new RestApi(this, `dea-api`, {
      description: 'Backend API',
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
      deployOptions: {
        stageName: STAGE,
        accessLogDestination: new LogGroupLogDestination(accessLogGroup),
        accessLogFormat: AccessLogFormat.custom(
          JSON.stringify({
            stage: '$context.stage',
            requestId: '$context.requestId',
            integrationRequestId: '$context.integration.requestId',
            status: '$context.status',
            apiId: '$context.apiId',
            resourcePath: '$context.resourcePath',
            path: '$context.path',
            resourceId: '$context.resourceId',
            httpMethod: '$context.httpMethod',
            sourceIp: '$context.identity.sourceIp',
            userAgent: '$context.identity.userAgent',
          })
        ),
      },
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'CSRF-Token',
          'idToken',
          'x-amz-security-token',
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: Cors.ALL_ORIGINS,
      },
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });

    this._configureApiGateway(deaApiRouteConfig, props.lambdaEnv);
  }

  private _configureApiGateway(routeConfig: ApiGatewayRouteConfig, lambdaEnv: LambdaEnvironment): void {
    const plan = this.deaRestApi.addUsagePlan('DEA Usage Plan', {
      name: 'dea-usage-plan',
      throttle: {
        rateLimit: 25,
        burstLimit: 50,
      },
    });

    plan.addApiStage({
      api: this.deaRestApi,
      stage: this.deaRestApi.deploymentStage,
    });

    createCfnOutput(this, 'deaApiUrl', {
      value: this.deaRestApi.url,
    });

    routeConfig.routes.forEach((route) => {
      // If this is a non-Auth API, then we specify the auth method (Non-IAM)
      // and we should give the lambda limited permissions
      // otherwise it is a DEA execution API, which needs the
      // full set of permissions
      const lambdaRole = route.authMethod ? this.authLambdaRole : this.lambdaBaseRole;
      this._addMethod(this.deaRestApi, route, lambdaRole, lambdaEnv);
    });
  }

  private _addMethod(api: RestApi, route: ApiGatewayRoute, role: Role, lambdaEnv: LambdaEnvironment): void {
    const urlParts = route.path.split('/').filter((str) => str);
    let parent = api.root;
    urlParts.forEach((part, index) => {
      let resource = parent.getResource(part);
      if (!resource) {
        resource = parent.addResource(part);
      }

      if (index === urlParts.length - 1) {
        const lambda = this._createLambda(
          `${route.httpMethod}_${route.eventName}`,
          role,
          route.pathToSource,
          lambdaEnv
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let queryParams: any = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let methodQueryParams: any = {};

        if (route.pagination) {
          queryParams['integration.request.querystring.limit'] = 'method.request.querystring.limit';
          queryParams['integration.request.querystring.next'] = 'method.request.querystring.next';
          methodQueryParams['method.request.querystring.limit'] = false;
          methodQueryParams['method.request.querystring.next'] = false;
        }

        if (route.queryParams) {
          route.queryParams.forEach((param) => {
            queryParams[`integration.request.querystring.${param}`] = `method.request.querystring.${param}`;
            methodQueryParams[`method.request.querystring.${param}`] = false;
          });
        }

        if (Object.keys(queryParams).length === 0) {
          queryParams = undefined;
          methodQueryParams = undefined;
        }

        const methodIntegration = new LambdaIntegration(lambda, {
          proxy: true,
          requestParameters: queryParams,
        });
        const method = resource.addMethod(route.httpMethod, methodIntegration, {
          requestParameters: methodQueryParams,
          // Custom auth type or None based on dea-route-config. Usually reserved for auth or ui methods
          authorizationType: route.authMethod ?? AuthorizationType.IAM,
        });

        if (method.methodArn.endsWith('*')) {
          throw new Error('Resource paths must not end with a wildcard.');
        }
        this.apiEndpointArns.set(route.path + route.httpMethod, method.methodArn);
      }
      parent = resource;
    });
  }

  private _createLambda(
    id: string,
    role: Role,
    pathToSource: string,
    lambdaEnv: LambdaEnvironment
  ): NodejsFunction {
    const lambda = new NodejsFunction(this, id, {
      memorySize: 512,
      role: role,
      timeout: Duration.seconds(30),
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

    //CFN NAG Suppression
    const lambdaMetaDataNode = lambda.node.defaultChild;
    if (lambdaMetaDataNode instanceof CfnFunction) {
      lambdaMetaDataNode.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W58',
            reason:
              'AWSCustomResource Lambda Function has AWSLambdaBasicExecutionRole policy attached which has the required permission to write to Cloudwatch Logs',
          },
          {
            id: 'W92',
            reason: 'Reserved concurrency is currently not required. Revisit in the future',
          },
          {
            id: 'W89',
            reason:
              'The serverless application lens (https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/aws-lambda.html)\
               indicates lambdas should not be deployed in private VPCs unless they require acces to resources also within a VPC',
          },
        ],
      });
    }
    return lambda;
  }

  private _createLambdaBaseRole(
    kmsKeyArn: string,
    tableArn: string,
    datasetsBucketArn: string,
    region: string,
    accountId: string
  ): Role {
    const basicExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole'
    );
    const role = new Role(this, 'dea-base-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [basicExecutionPolicy],
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:DeleteItem',
          'dynamodb:BatchGetItem',
          'dynamodb:BatchWriteItem',
          'dynamodb:PutItem',
          'dynamodb:Query',
          'dynamodb:UpdateItem',
        ],
        resources: [tableArn, `${tableArn}/index/GSI1`, `${tableArn}/index/GSI2`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: [
          's3:AbortMultipartUpload',
          's3:ListMultipartUploadParts',
          's3:PutObject',
          's3:GetObject',
          's3:GetObjectVersion',
          's3:GetObjectLegalHold',
          's3:PutObjectLegalHold',
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

    role.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameters', 'ssm:GetParameter'],
        resources: [`arn:aws:ssm:${region}:${accountId}:parameter/dea/${region}/*`],
      })
    );

    return role;
  }

  private _createAuthLambdaRole(region: string, accountId: string): Role {
    const basicExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole'
    );
    const role = new Role(this, 'dea-auth-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [basicExecutionPolicy],
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameters', 'ssm:GetParameter'],
        resources: [`arn:aws:ssm:${region}:${accountId}:parameter/dea/${region}/*`],
      })
    );

    return role;
  }
}
