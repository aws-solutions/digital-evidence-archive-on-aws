/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import * as path from 'path';
import { CfnOutput, Duration, StackProps } from 'aws-cdk-lib';
import {
  AccessLogFormat,
  AuthorizationType,
  LambdaIntegration,
  LogGroupLogDestination,
  RestApi,
  TokenAuthorizer,
} from 'aws-cdk-lib/aws-apigateway';
import { AccountRecovery, UserPool } from 'aws-cdk-lib/aws-cognito';
import {
  CfnSecurityGroup,
  FlowLog,
  FlowLogDestination,
  FlowLogResourceType,
  SecurityGroup,
  SubnetType,
  Vpc,
} from 'aws-cdk-lib/aws-ec2';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Alias, CfnFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as nodejsLambda from 'aws-cdk-lib/aws-lambda-nodejs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { getConstants } from './constants';

interface IBackendStackProps extends StackProps {
  kmsKey: Key;
}

enum MethodOptions {
  Get = 'GET',
  Post = 'POST',
  Put = 'PUT',
  Delete = 'DELETE',
}

export class DeaBackendConstruct extends Construct {
  public constructor(scope: Construct, id: string, props: IBackendStackProps) {
    const { COGNITO_DOMAIN, STACK_NAME } = getConstants();

    super(scope, STACK_NAME);

    //take a optional VPC from config, if not provided create one
    const vpc = this._createVpc(props.kmsKey);
    const lambdaSecurityGroup = this._createLambdasSecurityGroup(vpc);
    const authorizer = this._createLambdaAuthorizer(lambdaSecurityGroup, vpc);
    const apiLambda = this._createAPILambda(lambdaSecurityGroup, vpc);
    const API = this._createRestApi(apiLambda, props.kmsKey);
    const helloLambda = this._createLambda('HelloWorld', 'hello-world-handler', lambdaSecurityGroup, vpc);
    this._createApiResource(
      API,
      authorizer,
      'hello',
      new Map<MethodOptions, NodejsFunction>([[MethodOptions.Get, helloLambda]])
    );

    this._createCognitoUserPool(COGNITO_DOMAIN);
  }

  private _createVpc(key: Key): Vpc {
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

    new CfnSecurityGroup(this, 'vpc-sg', {
      groupDescription: 'dea-vpc security group',
      securityGroupEgress: [
        {
          ipProtocol: 'tcp',

          // the properties below are optional
          cidrIp: '0.0.0.0/32',
          fromPort: 1,
          toPort: 1,
          description: 'egress rule for dea vpc',
        },
      ],
      vpcId: vpc.vpcId,
    });

    const logGroup = new LogGroup(this, 'dea-vpc-log-group', {
      encryptionKey: key,
    });

    const role = new Role(this, 'flow-log-role', {
      assumedBy: new ServicePrincipal('vpc-flow-logs.amazonaws.com'),
    });

    new FlowLog(this, 'FlowLog', {
      resourceType: FlowLogResourceType.fromVpc(vpc),
      destination: FlowLogDestination.toCloudWatchLogs(logGroup, role),
    });

    return vpc;
  }

  private _createLambdasSecurityGroup(vpc: Vpc): SecurityGroup {
    const lambdaSecurityGroup = new SecurityGroup(this, 'testSecurityGroup', {
      vpc,
      description: 'security group for restapi lambda',
    });
    // nag suppresions related to egress rules
    this._addEgressSuppressions(lambdaSecurityGroup);
    return lambdaSecurityGroup;
  }

  private _createLambda(
    lambdaName: string,
    lambdaFileName: string,
    lambdaSecurityGroup: SecurityGroup,
    vpc: Vpc
  ): NodejsFunction {
    const vpcExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaVPCAccessExecutionRole'
    );
    const basicExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole'
    );
    const role = new Role(this, lambdaName + 'lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [vpcExecutionPolicy, basicExecutionPolicy],
    });

    const securityGroups = [];
    securityGroups.push(lambdaSecurityGroup);

    const lambdaService = new nodejsLambda.NodejsFunction(this, lambdaName, {
      memorySize: 512,
      vpc,
      role: role,
      timeout: Duration.minutes(3),
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler',
      securityGroups: securityGroups,
      entry: path.join(__dirname, '../../dea-app/src/lambda-handlers', lambdaFileName + '.ts'),
      depsLockFilePath: path.join(__dirname, '/../../common/config/rush/pnpm-lock.yaml'),
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: false,
      },
    });

    //CFN NAG Suppression
    const lambdaMetaDataNode = lambdaService.node.defaultChild;
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
        ],
      });
    }
    return lambdaService;
  }

  private _createLambdaAuthorizer(lambdaSecurityGroup: SecurityGroup, vpc: Vpc): TokenAuthorizer {
    const authLambda = this._createLambda(
      'CustomTokenAuthorizerLambda',
      'custom-lambda-authorizer',
      lambdaSecurityGroup,
      vpc
    );

    return new TokenAuthorizer(this, 'CustomTokenAuthorizer', {
      handler: authLambda,
    });
  }

  private _createApiResource(
    API: RestApi,
    authorizer: TokenAuthorizer,
    resourceName: string,
    methodFunctions: Map<MethodOptions, NodejsFunction>
  ): void {
    const resource = API.root.addResource(resourceName);
    // now add method with their lambda handlers for the given method types, e.g. GET, PUT, POST
    Array.from(methodFunctions.entries()).forEach((entry) =>
      resource.addMethod(entry[0], new LambdaIntegration(entry[1]), {
        authorizer: authorizer,
        authorizationType: AuthorizationType.CUSTOM,
      })
    );
  }

  // Create Lambda
  private _createAPILambda(lambdaSecurityGroup: SecurityGroup, vpc: Vpc): NodejsFunction {
    const vpcExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaVPCAccessExecutionRole'
    );
    const basicExecutionPolicy = ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole'
    );
    const role = new Role(this, 'dea-base-lambda-role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [vpcExecutionPolicy, basicExecutionPolicy],
    });

    const securityGroups = [];
    securityGroups.push(lambdaSecurityGroup);

    const lambdaService = new nodejsLambda.NodejsFunction(this, 'dea-app-handler', {
      memorySize: 512,
      vpc,
      role: role,
      timeout: Duration.minutes(3),
      runtime: Runtime.NODEJS_16_X,
      handler: 'handler',
      securityGroups: securityGroups,
      entry: path.join(__dirname, '/../src/backend-api-lambda.ts'),
      depsLockFilePath: path.join(__dirname, '/../../common/config/rush/pnpm-lock.yaml'),
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: false,
      },
    });

    //CFN NAG Suppression
    const lambdaMetaDataNode = lambdaService.node.defaultChild;
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
        ],
      });
    }
    return lambdaService;
  }

  // API Gateway
  private _createRestApi(apiLambda: NodejsFunction, key: Key): RestApi {
    const logGroup = new LogGroup(this, 'APIGatewayAccessLogs', {
      encryptionKey: key,
    });
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

    const plan = API.addUsagePlan('Backend Usage Plan', {
      name: 'backend-usage-plan',
      throttle: {
        rateLimit: 25,
        burstLimit: 50,
      },
    });

    plan.addApiStage({
      api: API,
      stage: API.deploymentStage,
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

    return API;
  }

  private _createCognitoUserPool(domain: string): void {
    const pool = new UserPool(this, 'DEAUserPool', {
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      // Below is Basic Password Policy, though it is missing the ability for
      // banned passwords, password expiry, password history etc
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(1),
      },
      /*we only want admins to create users, which then can be
      used to force users to be federated with IdP only.
      Also only want users invited to the app to use*/
      selfSignUpEnabled: false,
      standardAttributes: {
        familyName: {
          required: true,
          mutable: false,
        },
        givenName: {
          required: true,
          mutable: false,
        },
      },
      userInvitation: {
        emailSubject: 'Digital Evidence Archive Signup Invitation',
        emailBody: 'Hello {username}, you have been invited to use DEA! Your temporary password is {####}',
        smsMessage: 'Hello {username}, your temporary password for our DEA is {####}',
      },
      userPoolName: 'DEAUserPool',
    });

    pool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: domain,
      },
    });

    // PLACEHOLDER: setup IdP construct here. cdk: SamlProvider, then connect to user
    // pool with IUserPoolIdentityProvider. Impl Details will be provided in the Implementation Guide
    // If you choose the SSO route instead, just create the SamlProvider struct and follow instructions
    // for configuring IdP for SAML response and swapping out Cognito in the lambda authorizer

    const client = pool.addClient('dea-app-client', {
      accessTokenValidity: Duration.minutes(30),
      // use Server-side authentication workflow
      authFlows: {
        adminUserPassword: true,
      },
      enableTokenRevocation: true,
      generateSecret: true,
      idTokenValidity: Duration.days(1),

      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        callbackUrls: ['https://' + domain + '.com/welcome'],
        logoutUrls: ['https://' + domain + '.com/signin'],
      },

      preventUserExistenceErrors: true,
      refreshTokenValidity: Duration.days(1),
      userPoolClientName: 'dea-app-client',
    });

    new CfnOutput(this, 'CognitoUserPoolId', {
      value: pool.userPoolId,
      exportName: 'UserPoolId',
    });

    new CfnOutput(this, 'CognitoUserPoolClientId', {
      value: client.userPoolClientId,
      exportName: 'UserPoolClientId',
    });
  }

  private _addEgressSuppressions(sg: SecurityGroup): void {
    const resource = sg.node.defaultChild;
    if (resource instanceof CfnSecurityGroup) {
      resource.addMetadata('cfn_nag', {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        rules_to_suppress: [
          {
            id: 'W40',
            reason: 'Revisit later. Need to discuss ip protocol',
          },
          {
            id: 'W5',
            reason: 'Revisit later. Unable to set CIDR range on egress',
          },
        ],
      });
    }
  }
}
