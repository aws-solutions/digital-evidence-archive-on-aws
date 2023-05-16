/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { AuditEventType } from '@aws/dea-app/lib/app/services/audit-service';
import { Duration, Fn } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  AuthorizationType,
  EndpointType,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import {
  ArnPrincipal,
  Effect,
  ManagedPolicy,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Bucket, HttpMethods } from 'aws-cdk-lib/aws-s3';
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  AwsSdkCall,
  PhysicalResourceId,
} from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { ApiGatewayRoute, ApiGatewayRouteConfig } from '../resources/api-gateway-route-config';
import { deaApiRouteConfig } from '../resources/dea-route-config';
import { createCfnOutput } from './construct-support';
import { DeaOperationalDashboard } from './dea-ops-dashboard';

interface LambdaEnvironment {
  [key: string]: string;
}
interface DeaRestApiProps {
  deaTableArn: string;
  deaTableName: string;
  deaDatasetsBucket: Bucket;
  s3BatchDeleteCaseFileRoleArn: string;
  deaAuditLogArn: string;
  deaTrailLogArn: string;
  kmsKey: Key;
  region: string;
  accountId: string;
  lambdaEnv: LambdaEnvironment;
  opsDashboard: DeaOperationalDashboard;
}

export class DeaRestApiConstruct extends Construct {
  public authLambdaRole: Role;
  public lambdaBaseRole: Role;
  public customResourceRole: Role;
  public deaRestApi: RestApi;
  public apiEndpointArns: Map<string, string>;
  private opsDashboard: DeaOperationalDashboard;

  public constructor(scope: Construct, stackName: string, props: DeaRestApiProps) {
    super(scope, stackName);

    this.apiEndpointArns = new Map<string, string>();

    const partition = deaConfig.partition();

    this.lambdaBaseRole = this.createLambdaBaseRole(
      props.kmsKey.keyArn,
      props.deaTableArn,
      props.deaDatasetsBucket.bucketArn,
      props.region,
      props.accountId,
      partition,
      props.deaAuditLogArn,
      props.deaTrailLogArn,
      props.s3BatchDeleteCaseFileRoleArn
    );

    this.authLambdaRole = this.createAuthLambdaRole(props.region, props.accountId, partition);

    this.customResourceRole = new Role(this, 'custom-resource-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    props.kmsKey.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        principals: [
          new ArnPrincipal(this.lambdaBaseRole.roleArn),
          new ArnPrincipal(this.authLambdaRole.roleArn),
        ],
        resources: ['*'],
        sid: 'lambda-roles-key-share-statement',
      })
    );

    const accessLogGroup = new LogGroup(this, 'APIGatewayAccessLogs', {
      encryptionKey: props.kmsKey,
    });

    const STAGE = deaConfig.stage();

    this.opsDashboard = props.opsDashboard;

    this.deaRestApi = new RestApi(this, `dea-api`, {
      description: 'Backend API',
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
      deployOptions: {
        stageName: STAGE,
        metricsEnabled: true,
        // Per method throttling limit. Conservative setting based on fact that we have 35 APIs and Lambda concurrency is 1000
        // Worst case this setting could potentially initiate up to 1750 API calls running at any moment (which is over lambda limit),
        // but it is unlikely that all the APIs are going to be used at the 50TPS limit
        methodOptions: {
          '/*/*': {
            throttlingBurstLimit: 50,
            throttlingRateLimit: 50,
            metricsEnabled: true,
          },
        },
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
            integrationLatency: '$context.integrationLatency',
            responseLatency: '$context.responseLatency',
          })
        ),
      },
      defaultCorsPreflightOptions: deaConfig.preflightOptions(),
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
    });

    this.configureApiGateway(deaApiRouteConfig, props.lambdaEnv, props.accountId);

    this.updateBucketCors(this.deaRestApi, props.deaDatasetsBucket.bucketName);
  }

  private updateBucketCors(restApi: RestApi, bucketName: Readonly<string>) {
    const allowedOrigins = deaConfig.deaAllowedOriginsList();
    allowedOrigins.push(`https://${Fn.parseDomainName(restApi.url)}`);

    const updateCorsCall: AwsSdkCall = {
      service: 'S3',
      action: 'putBucketCors',
      parameters: {
        Bucket: bucketName,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: allowedOrigins,
              AllowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.HEAD],
              AllowedHeaders: ['*'],
            },
          ],
        },
      },
      physicalResourceId: PhysicalResourceId.of(restApi.restApiId),
    };

    const customResourcePolicy = AwsCustomResourcePolicy.fromSdkCalls({
      resources: AwsCustomResourcePolicy.ANY_RESOURCE,
    });

    customResourcePolicy.statements.forEach((statement) => this.customResourceRole.addToPolicy(statement));

    const updateCors = new AwsCustomResource(this, 'UpdateBucketCORS', {
      onCreate: updateCorsCall,
      onUpdate: updateCorsCall,
      role: this.customResourceRole,
      policy: customResourcePolicy,
      installLatestAwsSdk: false,
    });
    updateCors.node.addDependency(restApi);
  }

  private configureApiGateway(
    routeConfig: ApiGatewayRouteConfig,
    lambdaEnv: LambdaEnvironment,
    accountId: string
  ): void {
    const plan = this.deaRestApi.addUsagePlan('DEA Usage Plan', {
      name: 'dea-usage-plan',
      throttle: {
        rateLimit: 10,
        burstLimit: 10,
      },
    });

    plan.addApiStage({
      api: this.deaRestApi,
      stage: this.deaRestApi.deploymentStage,
    });

    createCfnOutput(this, 'UiUrl', {
      value: `${this.deaRestApi.url}ui`,
    });

    createCfnOutput(this, 'deaApiUrl', {
      value: this.deaRestApi.url,
    });

    routeConfig.routes.forEach((route) => {
      // Do NOT Deploy Delete Case Handler when 'deletionAllowed' Flag is NOT set in the config file.
      if (!deaConfig.deletionAllowed() && route.eventName === AuditEventType.DELETE_CASE) {
        return;
      }
      // If this is a non-Auth API, then we specify the auth method (Non-IAM)
      // and we should give the lambda limited permissions
      // otherwise it is a DEA execution API, which needs the
      // full set of permissions
      const lambdaRole = route.authMethod ? this.authLambdaRole : this.lambdaBaseRole;
      this.addMethod(this.deaRestApi, route, lambdaRole, lambdaEnv, accountId);
      this.opsDashboard.addMethodOperationalComponents(this.deaRestApi, route);
    });
  }

  private addMethod(
    api: RestApi,
    route: ApiGatewayRoute,
    role: Role,
    lambdaEnv: LambdaEnvironment,
    accountId: string
  ): void {
    const urlParts = route.path.split('/').filter((str) => str);
    let parent = api.root;
    urlParts.forEach((part, index) => {
      let resource = parent.getResource(part);
      if (!resource) {
        resource = parent.addResource(part);
      }

      if (index === urlParts.length - 1) {
        const lambda = this.createLambda(
          `${route.httpMethod}_${route.eventName}`,
          role,
          route.pathToSource,
          lambdaEnv,
          accountId
        );
        this.opsDashboard.addLambdaOperationalComponents(lambda, route.eventName, route);

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

  private createLambda(
    id: string,
    role: Role,
    pathToSource: string,
    lambdaEnv: LambdaEnvironment,
    accountId: string
  ): NodejsFunction {
    const lambda = new NodejsFunction(this, id, {
      memorySize: 512,
      role: role,
      timeout: Duration.seconds(10),
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, pathToSource),
      depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        STAGE: deaConfig.stage(),
        ALLOWED_ORIGINS: deaConfig.deaAllowedOrigins(),
        SAMESITE: deaConfig.sameSiteValue(),
        ...lambdaEnv,
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    lambda.addPermission('InvokeLambdaPermission', {
      action: 'lambda:InvokeFunction',
      principal: new ServicePrincipal('apigateway.amazonaws.com'),
      sourceAccount: accountId,
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
               indicates lambdas should not be deployed in private VPCs unless they require access to resources also within a VPC',
          },
        ],
      });
    }
    return lambda;
  }

  private createLambdaBaseRole(
    kmsKeyArn: string,
    tableArn: string,
    datasetsBucketArn: string,
    region: string,
    accountId: string,
    partition: string,
    auditLogArn: string,
    trailLogArn: string,
    s3BatchDeleteCaseFileRoleArn: string
  ): Role {
    const STAGE = deaConfig.stage();

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
          's3:RestoreObject',
        ],
        resources: [`${datasetsBucketArn}/*`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [`${datasetsBucketArn}`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['logs:StartQuery'],
        resources: [auditLogArn, trailLogArn],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['logs:GetQueryResults', 's3:CreateJob'],
        resources: ['*'],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [s3BatchDeleteCaseFileRoleArn],
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
        resources: [`arn:${partition}:ssm:${region}:${accountId}:parameter/dea/${region}/${STAGE}*`],
      })
    );

    return role;
  }

  private createAuthLambdaRole(region: string, accountId: string, partition: string): Role {
    const STAGE = deaConfig.stage();

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
        resources: [`arn:${partition}:ssm:${region}:${accountId}:parameter/dea/${region}/${STAGE}*`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:${partition}:secretsmanager:${region}:${accountId}:secret:/dea/${region}/${STAGE}/clientSecret-*`,
        ],
      })
    );

    return role;
  }
}
