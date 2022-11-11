/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import * as path from 'path';
import { CfnOutput, Duration, SecretValue, StackProps } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import {
  AccountRecovery,
  Mfa,
  OAuthScope,
  UserPool,
  UserPoolClient,
  UserPoolClientOptions,
  UserPoolDomain,
  UserPoolIdentityProviderOidc,
  UserPoolProps,
} from 'aws-cdk-lib/aws-cognito';
import {
  FlowLog,
  FlowLogDestination,
  FlowLogResourceType,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Alias, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { getConstants } from './constants';
import { DEACognitoProps } from './types/DEACognitoProps';

export class DeaBackendConstruct extends Construct {
  public constructor(scope: Construct, id: string, props?: StackProps) {
    const { COGNITO_DOMAIN, STACK_NAME, USER_POOL_CLIENT_NAME, WEBSITE_URLS } = getConstants();

    super(scope, STACK_NAME);

    //take a optional VPC from config, if not provided create one
    const vpc = this._createVpc();
    const apiLambda = this._createAPILambda(vpc);
    this._createRestApi(apiLambda);
    this._createCognitoResources(COGNITO_DOMAIN, WEBSITE_URLS, USER_POOL_CLIENT_NAME);
  }

  private _createVpc(): Vpc {
    const vpc = new Vpc(this, 'dea-vpc', {
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Ingress',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    new SecurityGroup(this, 'vpc-sg', {
      vpc,
    });

    const logGroup = new LogGroup(this, 'dea-vpc-log-group');

    const role = new Role(this, 'flow-log-role', {
      assumedBy: new ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    new FlowLog(this, 'FlowLog', {
      resourceType: FlowLogResourceType.fromVpc(vpc),
      destination: FlowLogDestination.toCloudWatchLogs(logGroup, role),
    });

    return vpc;
  }

  // Create Lambda
  private _createAPILambda(vpc: Vpc): NodejsFunction {
    const vpcExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaVPCAccessExecutionRole'
    );
    const role = new Role(this, 'dea-base-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [vpcExecutionPolicy],
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
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: false,
      },
    });

    return lambdaService;
  }

  // API Gateway
  private _createRestApi(apiLambda: NodejsFunction): void {
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
            userAgent: '$context.identity.userAgent',
          })
        ),
      },
      // TODO: Add CORS Preflight
    });

    API.addUsagePlan('Backend Usage Plan', {
      name: 'backend-usage-plan',
    });

    new CfnOutput(this, 'apiUrlOutput', {
      value: API.url,
    });

    // Lambda Alias
    const alias = new Alias(this, 'LiveAlias', {
      aliasName: 'live',
      version: apiLambda.currentVersion,
    });
    API.root.addProxy({
      defaultIntegration: new LambdaIntegration(alias),
    });
  }

  private _createCognitoResources(
    domainPrefix: string,
    websiteUrls: string[],
    userPoolClientName: string
  ): DEACognitoProps {
    const userPoolDefaults: UserPoolProps = {
      accountRecovery: AccountRecovery.NONE,
      enableSmsRole: false,
      mfa: Mfa.REQUIRED,
      selfSignUpEnabled: false, // only admin can create users
      signInAliases: {
        // only sign in with email
        username: false,
        email: false,
      },
      signInCaseSensitive: false,
      standardAttributes: {
        givenName: {
          required: true,
        },
        familyName: {
          required: true,
        },
        email: {
          required: true,
        },
      },
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
    };

    const userPool = new UserPool(this, 'DEAUserPool', userPoolDefaults);

    const userPoolDomain = new UserPoolDomain(this, 'DEAUserPoolDomain', {
      userPool: userPool,
      cognitoDomain: { domainPrefix },
    });

    const provider = new UserPoolIdentityProviderOidc(this, `DEAUserPoolIdentityProviderOidc`, {
      clientId: 'bogus',
      clientSecret: 'bogus',
      issuerUrl: 'bogus',
      userPool: userPool,
      scopes: ['openid', 'profile', 'email'],
    });
    userPool.registerIdentityProvider(provider);

    const userPoolClientProps: UserPoolClientOptions = {
      generateSecret: true,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [OAuthScope.OPENID],
      },
      authFlows: {
        adminUserPassword: true,
        userSrp: true,
        custom: true,
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      idTokenValidity: Duration.minutes(15),
      accessTokenValidity: Duration.minutes(15),
      refreshTokenValidity: Duration.days(7),
    };

    const userPoolClient = new UserPoolClient(this, 'DEAUserPoolClient', {
      ...userPoolClientProps,
      userPool,
      userPoolClientName,
    });

    userPool.identityProviders.forEach((provider) => userPoolClient.node.addDependency(provider));

    return {
      cognitoDomain: userPoolDomain.baseUrl(),
      userPoolId: userPool.userPoolId,
      userPoolClientId: userPoolClient.userPoolClientId,
      userPoolClientSecret: SecretValue.unsafePlainText('bogus'),
    };
  }
}
