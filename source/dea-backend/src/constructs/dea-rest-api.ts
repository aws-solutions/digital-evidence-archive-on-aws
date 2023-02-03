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

interface DeaRestApiProps {
  deaTableArn: string;
  kmsKey: Key;
  region: string;
  accountId: string;
}

export class DeaRestApiConstruct extends Construct {
  public lambdaBaseRole: Role;
  public deaRestApi: RestApi;
  public apiEndpointArns: Map<string, string>;

  public constructor(scope: Construct, stackName: string, props: DeaRestApiProps) {
    super(scope, stackName);

    this.apiEndpointArns = new Map<string, string>();

    this.lambdaBaseRole = this._createLambdaBaseRole(
      props.kmsKey.keyArn,
      props.deaTableArn,
      props.region,
      props.accountId
    );

    const accessLogGroup = new LogGroup(this, 'APIGatewayAccessLogs', {
      encryptionKey: props.kmsKey,
    });

    const STAGE = deaConfig.stage();

    this.deaRestApi = new RestApi(this, `dea-api`, {
      description: 'Backend API',
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
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'CSRF-Token'],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowCredentials: true,
        allowOrigins: Cors.ALL_ORIGINS,
      },
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });

    this._configureApiGateway(props.deaTableArn, props.kmsKey, deaApiRouteConfig);
  }

  private _configureApiGateway(tableArn: string, key: Key, routeConfig: ApiGatewayRouteConfig): void {
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

    createCfnOutput(this, 'deaApiUrlOutput', {
      value: this.deaRestApi.url,
      exportName: 'deaApiUrl',
    });

    routeConfig.routes.forEach((route) => this._addMethod(this.deaRestApi, route, this.lambdaBaseRole));
  }

  private _addMethod(api: RestApi, route: ApiGatewayRoute, role: Role): void {
    const urlParts = route.path.split('/').filter((str) => str);
    let parent = api.root;
    urlParts.forEach((part, index) => {
      let resource = parent.getResource(part);
      if (!resource) {
        resource = parent.addResource(part);
      }

      if (index === urlParts.length - 1) {
        const lambda = this._createLambda(`${route.httpMethod}_${part}`, role, route.pathToSource);

        const paginationParams = {
          'integration.request.querystring.limit': 'method.request.querystring.limit',
          'integration.request.querystring.next': 'method.request.querystring.next',
        };

        const paginationMethodParams = {
          'method.request.querystring.limit': false,
          'method.request.querystring.next': false,
        };

        const methodIntegration = new LambdaIntegration(lambda, {
          proxy: true,
          requestParameters: route.pagination ? paginationParams : undefined,
        });
        const method = resource.addMethod(route.httpMethod, methodIntegration, {
          requestParameters: route.pagination ? paginationMethodParams : undefined,
          authorizationType: AuthorizationType.IAM,
        });

        this.apiEndpointArns.set(route.path + route.httpMethod, method.methodArn);
      }
      parent = resource;
    });
  }

  private _createLambda(id: string, role: Role, pathToSource: string): NodejsFunction {
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
        actions: ['kms:Encrypt', 'kms:Decrypt'],
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
}
