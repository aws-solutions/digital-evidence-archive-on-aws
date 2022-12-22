/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  AuthorizationType,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi,
  TokenAuthorizer,
} from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { ApiGatewayRoute, ApiGatewayRouteConfig } from '../resources/api-gateway-route-config';
import { deaApiRouteConfig } from '../resources/dea-route-config';

interface DeaRestApiProps {
  deaTableArn: string;
  kmsKey: Key;
}

export class DeaRestApiConstruct extends Construct {
  public lambdaBaseRole: Role;

  public constructor(scope: Construct, stackName: string, props: DeaRestApiProps) {
    super(scope, stackName);

    this.lambdaBaseRole = this._createLambdaBaseRole(props.kmsKey.keyArn, props.deaTableArn);

    this._createApiGateway(props.deaTableArn, props.kmsKey, deaApiRouteConfig);
  }

  private _createApiGateway(tableArn: string, key: Key, routeConfig: ApiGatewayRouteConfig): void {
    const accessLogGroup = new LogGroup(this, 'APIGatewayAccessLogs', {
      encryptionKey: key,
    });

    const api = new RestApi(this, `dea-api`, {
      description: 'Backend API',
      deployOptions: {
        stageName: 'dev',
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
      // TODO: Add CORS Preflight
    });

    const plan = api.addUsagePlan('DEA Usage Plan', {
      name: 'dea-usage-plan',
      throttle: {
        rateLimit: 25,
        burstLimit: 50,
      },
    });

    plan.addApiStage({
      api: api,
      stage: api.deploymentStage,
    });

    new CfnOutput(this, 'deaApiUrlOutput', {
      value: api.url,
      exportName: 'deaApiUrl',
    });

    const customAuthorizer = this._createLambdaAuthorizer(this.lambdaBaseRole);

    routeConfig.routes.forEach((route) => this._addMethod(api, route, this.lambdaBaseRole, customAuthorizer));
  }

  private _addMethod(api: RestApi, route: ApiGatewayRoute, role: Role, authorizer: TokenAuthorizer): void {
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
        resource.addMethod(route.httpMethod, methodIntegration, {
          requestParameters: route.pagination ? paginationMethodParams : undefined,
          authorizer,
          authorizationType: AuthorizationType.CUSTOM,
        });
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

  private _createLambdaBaseRole(kmsKeyArn: string, tableArn: string): Role {
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

    return role;
  }

  private _createLambdaAuthorizer(role: Role): TokenAuthorizer {
    const authLambda = this._createLambda(
      'CustomTokenAuthorizerLambda',
      role,
      '../../src/handlers/custom-authz-handler.ts'
    );

    return new TokenAuthorizer(this, 'CustomTokenAuthorizer', {
      handler: authLambda,
      resultsCacheTtl: Duration.seconds(0),
    });
  }
}
