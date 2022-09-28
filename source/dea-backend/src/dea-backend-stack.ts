/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable no-new */
/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import { join } from 'path';
import * as path from 'path';
import { WorkbenchCognito, WorkbenchCognitoProps } from '@aws/workbench-core-infrastructure';
import { Stack, CfnOutput, StackProps, Duration } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi
} from 'aws-cdk-lib/aws-apigateway';
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

    const apiLambda: NodejsFunction = this._createAPILambda();
    this._createRestApi(apiLambda);
    this._createCognitoResources(COGNITO_DOMAIN, WEBSITE_URLS, USER_POOL_NAME, USER_POOL_CLIENT_NAME);
  }

  // Create Lambda
  private _createAPILambda(): NodejsFunction {
    const lambdaService = new nodejsLambda.NodejsFunction(this, 'dea-app-handler', {
      memorySize: 512,
      timeout: Duration.minutes(3),
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler',
      entry: path.join(__dirname, '/../src/backendAPILambda.ts'),
      depsLockFilePath: join(__dirname, '/../../common/config/rush/pnpm-lock.yaml'),
      bundling: {
        externalModules: ['aws-sdk']
      }
    });

    return lambdaService;
  }

  // API Gateway
  private _createRestApi(apiLambda: NodejsFunction): void {
    const logGroup = new LogGroup(this, 'APIGatewayAccessLogs');
    const API: RestApi = new RestApi(this, `API-Gateway API`, {
      restApiName: 'Backend API Name',
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
  }
  private _createCognitoResources(
    domainPrefix: string,
    websiteUrls: string[],
    userPoolName: string,
    userPoolClientName: string
  ): WorkbenchCognito {
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
  }
}
