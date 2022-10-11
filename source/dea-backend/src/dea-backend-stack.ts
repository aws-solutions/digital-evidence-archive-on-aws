/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-new */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import * as path from 'path';
import { WorkbenchCognito, WorkbenchCognitoProps } from '@aws/workbench-core-infrastructure';
import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi
} from 'aws-cdk-lib/aws-apigateway';
import {
  FlowLog,
  FlowLogDestination,
  FlowLogResourceType,
  SecurityGroup,
  SubnetType,
  Vpc
} from 'aws-cdk-lib/aws-ec2';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Alias, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { getConstants } from './constants';

export class DeaBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    const { COGNITO_DOMAIN, USER_POOL_CLIENT_NAME, USER_POOL_NAME, WEBSITE_URLS } = getConstants();

    super(scope, id, props);

    //take a optional VPC from config, if not provided create one
    const vpc = this._createVpc();
    const apiLambda = this._createAPILambda(vpc);
    this._createRestApi(apiLambda);
    this._createCognitoResources(COGNITO_DOMAIN, WEBSITE_URLS, USER_POOL_NAME, USER_POOL_CLIENT_NAME);
  }

  private _createVpc = (): Vpc => {
    const vpc = new Vpc(this, 'dea-vpc', {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Ingress',
          subnetType: SubnetType.PRIVATE_ISOLATED
        }
      ]
    });

    new SecurityGroup(this, 'vpc-sg', {
      vpc
    });

    const logGroup = new LogGroup(this, 'dea-vpc-log-group');

    const role = new Role(this, 'flow-log-role', {
      assumedBy: new ServicePrincipal('vpc-flow-logs.amazonaws.com')
    });

    new FlowLog(this, 'FlowLog', {
      resourceType: FlowLogResourceType.fromVpc(vpc),
      destination: FlowLogDestination.toCloudWatchLogs(logGroup, role)
    });

    return vpc;
  };

  // Create Lambda
  private _createAPILambda = (vpc: Vpc): NodejsFunction => {
    const basicExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole'
    );
    const role = new Role(this, 'dea-base-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [basicExecutionPolicy]
    });

    const lambdaService = new nodejsLambda.NodejsFunction(this, 'dea-app-handler', {
      memorySize: 512,
      vpc,
      role: role,
      timeout: Duration.minutes(3),
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler',
      entry: path.join(__dirname, '/../src/backendAPILambda.ts'),
      depsLockFilePath: path.join(__dirname, '/../../common/config/rush/pnpm-lock.yaml'),
      bundling: {
        externalModules: ['aws-sdk']
      }
    });

    return lambdaService;
  };

  // API Gateway
  private _createRestApi = (apiLambda: NodejsFunction): void => {
    const logGroup = new LogGroup(this, 'APIGatewayAccessLogs');
    const API: RestApi = new RestApi(this, `API-Gateway API`, {
      description: 'Backend API',
      deployOptions: {
        stageName: 'dev',
        accessLogDestination: new LogGroupLogDestination(logGroup),
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
            userAgent: '$context.identity.userAgent'
          })
        )
      }
      // TODO: Add CORS Preflight
    });

    API.addUsagePlan('Backend Usage Plan', {
      name: 'backend-usage-plan'
    });

    new CfnOutput(this, 'apiUrlOutput', {
      value: API.url
    });

    // Lambda Alias
    const alias = new Alias(this, 'LiveAlias', {
      aliasName: 'live',
      version: apiLambda.currentVersion,
      provisionedConcurrentExecutions: 1
    });
    API.root.addProxy({
      defaultIntegration: new LambdaIntegration(alias)
    });
  };
  private _createCognitoResources = (
    domainPrefix: string,
    websiteUrls: string[],
    userPoolName: string,
    userPoolClientName: string
  ): WorkbenchCognito => {
    const props: WorkbenchCognitoProps = {
      domainPrefix: domainPrefix,
      websiteUrls: websiteUrls,
      userPoolName: userPoolName,
      userPoolClientName: userPoolClientName,
      oidcIdentityProviders: []
    };

    const workbenchCognito = new WorkbenchCognito(this, 'DigitalEvidenceArchiveCognito', props);

    new CfnOutput(this, 'cognitoUserPoolId', {
      value: workbenchCognito.userPoolId
    });

    new CfnOutput(this, 'cognitoUserPoolClientId', {
      value: workbenchCognito.userPoolClientId
    });

    new CfnOutput(this, 'cognitoDomainName', {
      value: workbenchCognito.cognitoDomain
    });

    return workbenchCognito;
  };
}
