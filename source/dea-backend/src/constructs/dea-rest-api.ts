/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { AuditEventType } from '@aws/dea-app/lib/app/services/audit-service';
import * as ServiceConstants from '@aws/dea-app/lib/app/services/service-constants';
import { Aws, Duration, Fn } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  AuthorizationType,
  DomainNameOptions,
  EndpointType,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi,
  SecurityPolicy,
} from 'aws-cdk-lib/aws-apigateway';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';
import { IInterfaceVpcEndpoint, InterfaceVpcEndpoint } from 'aws-cdk-lib/aws-ec2';
import {
  AnyPrincipal,
  ArnPrincipal,
  Effect,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
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

export interface AthenaConfig {
  athenaOutputBucket: Bucket;
  athenaWorkGroupName: string;
  athenaDBName: string;
  athenaTableName: string;
  athenaAuditBucket: Bucket;
}

interface DeaRestApiProps {
  deaTableArn: string;
  deaTableName: string;
  deaDatasetsBucket: Bucket;
  deaDatasetsBucketDataSyncRoleArn: string;
  s3BatchDeleteCaseFileRoleArn: string;
  deaDataSyncReportsBucket: Bucket;
  deaDataSyncReportsRoleArn: string;
  deaAuditLogArn: string;
  deaTrailLogArn: string;
  kmsKey: Key;
  lambdaEnv: LambdaEnvironment;
  opsDashboard?: DeaOperationalDashboard;
  athenaConfig: AthenaConfig;
}

export class DeaRestApiConstruct extends Construct {
  public authLambdaRole: Role;
  public lambdaBaseRole: Role;
  // datasetsRole and auditDownloadRole are needed to create session credentials to restrict pre-signed URL access parameters such as ip-address
  public datasetsRole: Role;
  public auditDownloadRole: Role;
  public customResourceRole: Role;
  public deaRestApi: RestApi;
  public apiEndpointArns: Map<string, string>;
  private opsDashboard?: DeaOperationalDashboard;
  public accessLogGroup: LogGroup;

  public constructor(
    scope: Construct,
    stackName: string,
    protectedDeaResourceArns: string[],
    props: DeaRestApiProps
  ) {
    super(scope, stackName);

    this.apiEndpointArns = new Map<string, string>();

    this.lambdaBaseRole = this.createLambdaBaseRole(
      props.kmsKey.keyArn,
      props.deaTableArn,
      props.deaDatasetsBucket.bucketArn,
      props.deaAuditLogArn,
      props.deaTrailLogArn,
      props.s3BatchDeleteCaseFileRoleArn,
      props.athenaConfig,
      props.deaDatasetsBucketDataSyncRoleArn,
      props.deaDataSyncReportsRoleArn
    );
    props.athenaConfig.athenaAuditBucket.grantRead(this.lambdaBaseRole);

    this.authLambdaRole = this.createAuthLambdaRole();

    this.datasetsRole = this.createDatasetsRole(props.kmsKey.keyArn, props.deaDatasetsBucket.bucketArn);

    this.auditDownloadRole = this.createAuditDownloadRole(
      props.kmsKey.keyArn,
      props.athenaConfig.athenaOutputBucket.bucketArn
    );

    props.lambdaEnv['DATASETS_ROLE'] = this.datasetsRole.roleArn;
    props.lambdaEnv['AUDIT_DOWNLOAD_ROLE_ARN'] = this.auditDownloadRole.roleArn;
    props.lambdaEnv['KEY_ARN'] = props.kmsKey.keyArn;
    props.lambdaEnv['DATASYNC_ROLE'] = props.deaDatasetsBucketDataSyncRoleArn;
    props.lambdaEnv['DATASYNC_REPORTS_BUCKET_NAME'] = props.deaDataSyncReportsBucket.bucketName;
    props.lambdaEnv['DATASYNC_REPORTS_ROLE'] = props.deaDataSyncReportsRoleArn;

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
          new ArnPrincipal(this.datasetsRole.roleArn),
          new ArnPrincipal(this.auditDownloadRole.roleArn),
        ],
        resources: ['*'],
        sid: 'lambda-roles-key-share-statement',
      })
    );

    this.accessLogGroup = new LogGroup(this, 'APIGatewayAccessLogs', {
      encryptionKey: props.kmsKey,
    });

    protectedDeaResourceArns.push(this.accessLogGroup.logGroupArn);

    const STAGE = deaConfig.stage();

    this.opsDashboard = props.opsDashboard;

    // Define your custom domain for use with the API if provided
    let domainNameOptions: DomainNameOptions | undefined;
    const customDomainNameInfo = deaConfig.customDomainInfo();
    const useCustomDomain = !!(
      customDomainNameInfo.domainName &&
      customDomainNameInfo.certificateArn &&
      customDomainNameInfo.hostedZoneId &&
      customDomainNameInfo.hostedZoneName
    );
    if (useCustomDomain) {
      domainNameOptions = {
        certificate: Certificate.fromCertificateArn(
          this,
          'CustomDomainCert',
          customDomainNameInfo.certificateArn ?? fail()
        ),
        domainName: customDomainNameInfo.domainName ?? fail(),
        securityPolicy: SecurityPolicy.TLS_1_2,
      };
    }

    const endpoint = deaConfig.vpcEndpointInfo() ? EndpointType.PRIVATE : EndpointType.REGIONAL;
    const policy = this.getApiGatewayPolicy();
    const vpcEndpoints = this.getVpcEndPointObject();

    this.deaRestApi = new RestApi(this, `dea-api`, {
      description: 'Backend API',
      endpointConfiguration: {
        types: [endpoint],
        vpcEndpoints,
      },
      deployOptions: {
        stageName: STAGE,
        metricsEnabled: true,
        // Per method throttling limit. Conservative setting based on fact that we have 35 APIs and Lambda concurrency is 1000
        // Worst case this setting could potentially initiate up to 1750 API calls running at any moment (which is over lambda limit),
        // but it is unlikely that all the APIs are going to be used at the 50TPS limit.
        // Throttle value set to 30 to match CloudWatch Logs Insights queries maximun concurrency and mitigate lambda function timeouts.
        // For instance: // CloudWatch Logs Insights queries have a maximum of 30 concurrent queries, including queries that have been added to dashboards. This quota can't be changed.
        methodOptions: {
          '/*/*': {
            throttlingBurstLimit: 40,
            throttlingRateLimit: 40,
            metricsEnabled: true,
          },
          // /availableEndpoints reads data from the Parameter Store.
          // Default throughput: 40 (Shared by the following API actions: GetParameter, GetParameters, GetParametersByPath)
          // 30TPS is the safe value to avoid getting 502's Http errors for this endpoint.
          '/availableEndpoints/GET': {
            throttlingBurstLimit: 30,
            throttlingRateLimit: 30,
            metricsEnabled: true,
          },
        },
        accessLogDestination: new LogGroupLogDestination(this.accessLogGroup),
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
      defaultMethodOptions: {
        authorizationType: AuthorizationType.IAM,
      },
      domainName: domainNameOptions,
      disableExecuteApiEndpoint: false,
      policy,
    });

    if (useCustomDomain) {
      new ARecord(this, 'AliasRecord', {
        zone: HostedZone.fromHostedZoneAttributes(this, 'HostedZoneId', {
          hostedZoneId: customDomainNameInfo.hostedZoneId ?? fail(),
          zoneName: customDomainNameInfo.hostedZoneName ?? fail(),
        }),
        target: RecordTarget.fromAlias(new ApiGateway(this.deaRestApi)),
      });
    }

    this.configureApiGateway(deaApiRouteConfig, props.lambdaEnv);

    this.updateBucketCors(this.deaRestApi, [
      props.deaDatasetsBucket.bucketName,
      props.athenaConfig.athenaOutputBucket.bucketName,
    ]);
  }

  private getApiGatewayPolicy(): PolicyDocument | undefined {
    const vpcEndpointInfo = deaConfig.vpcEndpointInfo();
    if (!vpcEndpointInfo) {
      return;
    }
    return new PolicyDocument({
      statements: [
        new PolicyStatement({
          actions: ['execute-api:Invoke'],
          resources: ['execute-api:/*/*/*'],
          effect: Effect.ALLOW,
          principals: [new AnyPrincipal()],
        }),
        new PolicyStatement({
          actions: ['execute-api:Invoke'],
          resources: ['execute-api:/*/*/*'],
          effect: Effect.DENY,
          principals: [new AnyPrincipal()],
          conditions: {
            StringNotEquals: {
              'aws:SourceVpce': vpcEndpointInfo.vpcEndpointId,
              'aws:SourceVpc': vpcEndpointInfo.vpcId,
            },
          },
        }),
      ],
    });
  }

  private getVpcEndPointObject(): IInterfaceVpcEndpoint[] | undefined {
    const vpcEndpointInfo = deaConfig.vpcEndpointInfo();
    if (!vpcEndpointInfo) {
      return;
    }

    return [
      InterfaceVpcEndpoint.fromInterfaceVpcEndpointAttributes(this, 'VpcEndpoint', {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        vpcEndpointId: vpcEndpointInfo.vpcEndpointId as string,
        port: 443,
      }),
    ];
  }

  private updateBucketCors(restApi: RestApi, bucketNames: ReadonlyArray<string>) {
    const allowedOrigins = deaConfig.deaAllowedOriginsList();
    allowedOrigins.push(`https://${Fn.parseDomainName(restApi.url)}`);

    const customDomainName = deaConfig.customDomainInfo().domainName;
    if (customDomainName) {
      allowedOrigins.push(`https://${customDomainName}`);
    }

    const customResourcePolicy = AwsCustomResourcePolicy.fromSdkCalls({
      resources: AwsCustomResourcePolicy.ANY_RESOURCE,
    });

    customResourcePolicy.statements.forEach((statement) => this.customResourceRole.addToPolicy(statement));

    bucketNames.forEach((bucketName, index) => {
      const updateCorsCall = this.getUpdateCorsCall(bucketName, allowedOrigins, restApi.restApiId);

      const updateCors = new AwsCustomResource(this, `UpdateBucketCORS${index}`, {
        onCreate: updateCorsCall,
        onUpdate: updateCorsCall,
        role: this.customResourceRole,
        policy: customResourcePolicy,
        installLatestAwsSdk: false,
      });
      updateCors.node.addDependency(restApi);
    });
  }

  private configureApiGateway(routeConfig: ApiGatewayRouteConfig, lambdaEnv: LambdaEnvironment): void {
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

    const resourcesWithPreflight: Set<string> = new Set<string>();
    routeConfig.routes.forEach((route) => {
      // Delete Case Handler is only needed for running integration and end-to-end tests.
      if (route.eventName === AuditEventType.DELETE_CASE && !deaConfig.isTestStack()) {
        return;
      }

      // If this is a non-Auth API, then we specify the auth method (Non-IAM)
      // and we should give the lambda limited permissions
      // otherwise it is a DEA execution API, which needs the
      // full set of permissions
      const lambdaRole = route.authMethod ? this.authLambdaRole : this.lambdaBaseRole;
      this.addMethod(this.deaRestApi, route, lambdaRole, lambdaEnv, resourcesWithPreflight);
      this.opsDashboard?.addMethodOperationalComponents(this.deaRestApi, route);
    });
  }

  private addMethod(
    api: RestApi,
    route: ApiGatewayRoute,
    role: Role,
    lambdaEnv: LambdaEnvironment,
    resourcesWithPreflight: Set<string>
  ): void {
    const urlParts = route.path.split('/').filter((str) => str);
    let parent = api.root;
    urlParts.forEach((part, index) => {
      let resource = parent.getResource(part);
      if (!resource) {
        resource = parent.addResource(part);
      }

      if (index === urlParts.length - 1) {
        if (!resourcesWithPreflight.has(resource.resourceId)) {
          resourcesWithPreflight.add(resource.resourceId);
          const preflightOpts = deaConfig.preflightOptions();
          if (preflightOpts) {
            resource.addCorsPreflight(preflightOpts);
          }
        }
        const lambda = this.createLambda(
          `${route.httpMethod}_${route.eventName}`,
          role,
          route.pathToSource,
          lambdaEnv
        );
        this.opsDashboard?.addLambdaOperationalComponents(lambda, route.eventName, route);

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
    lambdaEnv: LambdaEnvironment
  ): NodejsFunction {
    const lambda = new NodejsFunction(this, id, {
      // Set to 2048MB to mitigate memory allocation issues. Some executions were using more than 512MB.
      // E.g: Error: Runtime exited with error: signal: killed Runtime.ExitError.
      memorySize: 2048,
      role: role,
      timeout: Duration.seconds(20),
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, pathToSource),
      depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        STAGE: deaConfig.stage(),
        ALLOWED_ORIGINS: deaConfig.deaAllowedOrigins(),
        SAMESITE: deaConfig.sameSiteValue(),
        AWS_PARTITION: Aws.PARTITION,
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
      sourceAccount: Aws.ACCOUNT_ID,
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

  private getUpdateCorsCall(bucketName: string, allowedOrigins: string[], restApiId: string): AwsSdkCall {
    return {
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
      physicalResourceId: PhysicalResourceId.of(restApiId),
    };
  }

  private createLambdaBaseRole(
    kmsKeyArn: string,
    tableArn: string,
    datasetsBucketArn: string,
    auditLogArn: string,
    trailLogArn: string,
    s3BatchDeleteCaseFileRoleArn: string,
    athenaConfig: AthenaConfig,
    deaDatasetsBucketDataSyncRoleArn: string,
    deaDataSyncReportsRoleArn: string
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
        resources: [tableArn, `${tableArn}/index/GSI1`, `${tableArn}/index/GSI2`, `${tableArn}/index/GSI3`],
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
        actions: [
          'datasync:CreateLocationS3',
          'datasync:CreateTask',
          'datasync:StartTaskExecution',
          'datasync:UpdateTask',
          'datasync:UpdateTaskExecution',
          'datasync:ListTasks',
          'datasync:DescribeTask',
          'datasync:DescribeLocationS3',
          'datasync:ListTaskExecutions',
          'datasync:DescribeTaskExecution',
        ],
        resources: [`arn:${Aws.PARTITION}:datasync:${Aws.REGION}:${Aws.ACCOUNT_ID}:*`],
      })
    );

    const listBucketResources = [...deaConfig.dataSyncLocationBuckets(), datasetsBucketArn];
    role.addToPolicy(
      new PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: listBucketResources,
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
        resources: [
          s3BatchDeleteCaseFileRoleArn,
          deaDatasetsBucketDataSyncRoleArn,
          deaDataSyncReportsRoleArn,
        ],
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
        resources: [
          `arn:${Aws.PARTITION}:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:parameter${ServiceConstants.PARAM_PREFIX}${STAGE}*`,
        ],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: [
          's3:GetBucketLocation',
          's3:GetObject',
          's3:ListBucket',
          's3:ListBucketMultipartUploads',
          's3:ListMultipartUploadParts',
          's3:AbortMultipartUpload',
          's3:PutObject',
        ],
        resources: [
          athenaConfig.athenaOutputBucket.bucketArn,
          `${athenaConfig.athenaOutputBucket.bucketArn}/*`,
        ],
      })
    );

    // Athena Query permissions
    role.addToPolicy(
      new PolicyStatement({
        actions: ['athena:GetQueryResults', 'athena:GetQueryExecution', 'athena:StartQueryExecution'],
        resources: ['*'],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['athena:GetWorkgroup'],
        resources: [
          `arn:${Aws.PARTITION}:athena:${Aws.REGION}:${Aws.ACCOUNT_ID}:workgroup/${athenaConfig.athenaWorkGroupName}`,
        ],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['glue:GetTable', 'glue:GetDatabase'],
        resources: [
          `arn:${Aws.PARTITION}:glue:${Aws.REGION}:${Aws.ACCOUNT_ID}:catalog`,
          `arn:${Aws.PARTITION}:glue:${Aws.REGION}:${Aws.ACCOUNT_ID}:database/${athenaConfig.athenaDBName}`,
          `arn:${Aws.PARTITION}:glue:${Aws.REGION}:${Aws.ACCOUNT_ID}:table/${athenaConfig.athenaDBName}/${athenaConfig.athenaTableName}`,
        ],
      })
    );

    return role;
  }

  private createDatasetsRole(kmsKeyArn: string, datasetsBucketArn: string): Role {
    const role = new Role(this, 'dea-datasets-role', {
      assumedBy: this.lambdaBaseRole,
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject', 's3:GetObjectVersion'],
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

  private createAuditDownloadRole(kmsKeyArn: string, auditResultsBucketArn: string): Role {
    const role = new Role(this, 'dea-audit-download-role', {
      assumedBy: this.lambdaBaseRole,
    });

    role.addToPolicy(
      new PolicyStatement({
        actions: ['s3:GetObject', 's3:GetObjectVersion'],
        resources: [`${auditResultsBucketArn}/*`],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['kms:Decrypt', 'kms:GenerateDataKey'],
        resources: [kmsKeyArn],
      })
    );

    return role;
  }

  private createAuthLambdaRole(): Role {
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
        resources: [
          `arn:${Aws.PARTITION}:ssm:${Aws.REGION}:${Aws.ACCOUNT_ID}:parameter${ServiceConstants.PARAM_PREFIX}${STAGE}*`,
        ],
      })
    );

    role.addToPolicy(
      new PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:${Aws.PARTITION}:secretsmanager:${Aws.REGION}:${Aws.ACCOUNT_ID}:secret:${ServiceConstants.PARAM_PREFIX}${STAGE}/clientSecret-*`,
        ],
      })
    );

    return role;
  }
}
