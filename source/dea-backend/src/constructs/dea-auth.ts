/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { assert } from 'console';
import { RoleMappingMatchType } from '@aws-cdk/aws-cognito-identitypool-alpha';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AccountRecovery,
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
  CfnUserPoolGroup,
  UserPool,
  UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { FederatedPrincipal, Policy, PolicyStatement, Role, WebIdentityPrincipal } from 'aws-cdk-lib/aws-iam';
import { ParameterTier, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { uniqueId } from 'lodash';
import { deaConfig } from '../config';
import { createCfnOutput } from './construct-support';

interface DeaAuthProps {
  // We need to create IAM Roles with what APIs the Role can call
  // therefore we need the API endpoint ARNs from the API Gateway construct
  apiEndpointArns: Map<string, string>;
}

export class DeaAuthConstruct extends Construct {
  public constructor(scope: Construct, stackName: string, props: DeaAuthProps) {
    super(scope, stackName);

    const region = deaConfig.region();
    const cognitoDomain = deaConfig.cognitoDomain();

    // Auth Stack. Used to determine which APIs a user can access by assigning them
    // an IAM Role based on their Group/Role. E.g. User federates with the auth stack, given credentials based
    // on the role mapping in the Identity Pool, then user can call APIs as neccessary.
    // For reference application, CognitoUserPool will be used as the IdP, users will be added
    // to CognitoGroups, and assigned the Group IAM Role once federated with the IdPool
    // For production deployments, follow the ImplementationGuide on how to setup
    // and connect your existing CJIS-compatible IdP for SSO. IAM Role assigned
    // according to the UserRole defined in the SAML assertion document
    this._createAuthStack(props.apiEndpointArns, cognitoDomain, region);
  }

  private _createIamRole(
    roleName: string,
    description: string,
    apiEndpoints: Array<string>,
    principal: WebIdentityPrincipal
  ): Role {
    const role = new Role(this, roleName, {
      assumedBy: principal,
      description: description,
    });
    role.attachInlinePolicy(
      new Policy(this, roleName + 'Policy', {
        statements: [
          new PolicyStatement({
            actions: ['execute-api:Invoke'],
            resources: apiEndpoints,
          }),
        ],
      })
    );

    return role;
  }

  // For reference application, we use CognitoUserPool as Idp
  // so we will create Cognito Groups that users can be assigned to.
  // The group the user is in will determine what DEA APIs they can call
  // Case permissions are determined by a Case ACL in DDB, NOT by the Cognito Group
  private _createCognitoGroups(
    apiEndpointArns: Map<string, string>,
    userPoolId: string,
    identityPoolId: string
  ): Map<CfnUserPoolGroup, Role> {
    // Create Cognito Groups with IAM Roles that define what APIs are allowed to be called
    // The groups we create {Auditor, CaseWorker, Admin} are just examples
    // so customize to your agency's specific needs

    const principal = new WebIdentityPrincipal('cognito-identity.amazonaws.com', {
      StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPoolId },
      'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
    });

    const groupRoleMapping = new Map<CfnUserPoolGroup, Role>();

    // 3 General Groups:
    // * Admins: can call APIs to change system settings like re-assign case, or list all cases
    // * Auditors: can call Audit APIs to generate reports
    // * Case Workers: can create cases, and upload/download to cases they have permissions to (case ACL)

    const cognitoGroups = deaConfig.userGroups();
    cognitoGroups.forEach((group) => {
      const endpointStrings = group.endpoints.map((endpoint) => `${endpoint.path}${endpoint.method}`);
      const groupEndpoints = this._getEndpoints(apiEndpointArns, endpointStrings);
      this._createCognitoGroup(
        group.name,
        group.description,
        groupRoleMapping,
        groupEndpoints,
        principal,
        userPoolId,
        group.precedence
      );
    });

    return groupRoleMapping;
  }

  private _createAuthStack(
    apiEndpointArns: Map<string, string>,
    domain: string | undefined,
    region: string
  ): void {
    // See Implementation Guide for how to substitute your existing
    // Identity Provider in place of Cognito for SSO
    const [pool, poolClient] = this._createCognitoIdP(domain);

    const providerUrl = `cognito-idp.${region}.amazonaws.com/${pool.userPoolId}:${poolClient.userPoolClientId}`;

    const idPool = new CfnIdentityPool(this, 'DEAIdentityPool', {
      allowUnauthenticatedIdentities: false,
      allowClassicFlow: false, // Classic auth will not work with SAML IdPs
      // For SSO, you will replace this with samlProviderArns: ARN_OF_SAMLIDP
      cognitoIdentityProviders: [
        {
          providerName: pool.userPoolProviderName,
          serverSideTokenCheck: true,
          clientId: poolClient.userPoolClientId,
        },
      ],
    });

    // Create the Cognito Groups and their corresponding IAMRoles
    // Then tell the IdPool to map the cognito group from the token to get
    const groups: Map<CfnUserPoolGroup, Role> = this._createCognitoGroups(
      apiEndpointArns,
      pool.userPoolId,
      idPool.ref
    );
    const rules: CfnIdentityPoolRoleAttachment.MappingRuleProperty[] = new Array(groups.size);
    Array.from(groups.entries()).forEach((entry) => {
      rules.push({
        claim: 'cognito:groups',
        value: entry[0].groupName ?? uniqueId('DEAGroup_'),
        matchType: RoleMappingMatchType.CONTAINS,
        roleArn: entry[1].roleArn,
      });
    });
    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolCognitoRoleAttachment', {
      identityPoolId: idPool.ref,
      roleMappings: {
        roleMappingsKey: {
          type: 'Token',
          identityProvider: providerUrl,
          ambiguousRoleResolution: 'AuthenticatedRole',
          rulesConfiguration: {
            rules: rules,
          },
        },
      },
      roles: {
        authenticated: new Role(this, 'IdPoolAuthenticatedRole', {
          assumedBy: new FederatedPrincipal(
            'cognito-identity.amazonaws.com',
            {
              StringEquals: {
                'cognito-identity.amazonaws.com:aud': idPool.ref,
              },
              'ForAnyValue:StringLike': {
                'cognito-identity.amazonaws.com:amr': 'authenticated',
              },
            },
            'sts:AssumeRoleWithWebIdentity'
          ),
        }).roleArn,
        unauthenticated: new Role(this, 'IdPoolUnAuthenticatedRole', {
          assumedBy: new FederatedPrincipal(
            'cognito-identity.amazonaws.com',
            {
              StringEquals: {
                'cognito-identity.amazonaws.com:aud': idPool.ref,
              },
              'ForAnyValue:StringLike': {
                'cognito-identity.amazonaws.com:amr': 'unauthenticated',
              },
            },
            'sts:AssumeRoleWithWebIdentity'
          ),
        }).roleArn,
      },
    });

    createCfnOutput(this, 'Identity Pool', {
      value: idPool.ref,
      exportName: 'identityPoolId',
    });

    createCfnOutput(this, 'UserPoolId', {
      value: pool.userPoolId,
      exportName: 'userPoolId',
    });

    createCfnOutput(this, 'Pool Provider Url', {
      value: pool.userPoolProviderUrl,
    });

    createCfnOutput(this, 'UserPoolClientId', {
      value: poolClient.userPoolClientId,
      exportName: 'userPoolClientId',
    });

    // Add the user pool id and client id to SSM for use in the backend for verifying and decoding tokens
    this._addCognitoInformationToSSM(pool.userPoolId, poolClient.userPoolClientId, region);
  }

  // TODO add function for creating the IAM SAML IdP, which
  // describes the external IdP and establishes trust between it and
  // AWS, so that it can be used in DEA. This SAML ARN will be used
  // for federation with the Identity Pool

  // We use CognitoUserPool as the IdP for the reference application
  // TODO: determine if Cognito is CJIS compatible
  private _createCognitoIdP(domain: string | undefined): [UserPool, UserPoolClient] {
    const tempPasswordValidity = Duration.days(1);
    // must re-authenticate in every 12 hours
    // Note when inactive for 30+ minutes, you will also have to reauthenticate
    // due to session lock requirements. This is handled by session management code
    const accessTokenValidity = Duration.hours(12);
    const idTokenValidity = Duration.hours(12);
    const refreshTokenValidity = Duration.hours(12);

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
        tempPasswordValidity: tempPasswordValidity,
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
      removalPolicy: RemovalPolicy.DESTROY,
    });

    if (domain) {
      pool.addDomain('CognitoDomain', {
        cognitoDomain: {
          domainPrefix: domain,
        },
      });
    }

    const poolClient = pool.addClient('dea-app-client', {
      accessTokenValidity: accessTokenValidity,
      // use Server-side authentication workflow
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
      },
      enableTokenRevocation: true,
      generateSecret: false,
      idTokenValidity: idTokenValidity,

      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
      },

      preventUserExistenceErrors: true,
      refreshTokenValidity: refreshTokenValidity,
      userPoolClientName: 'dea-app-client',
    });

    return [pool, poolClient];
  }

  private _createCognitoGroup(
    name: string,
    desc: string,
    groupRoleMapping: Map<CfnUserPoolGroup, Role>,
    endpoints: string[],
    principal: WebIdentityPrincipal,
    userPoolId: string,
    precedence?: number
  ): void {
    const groupRole = this._createIamRole(`${name}Role`, `Role ${desc}`, endpoints, principal);
    const group = new CfnUserPoolGroup(this, name, {
      userPoolId: userPoolId,

      description: `Group ${desc}`,
      groupName: name,
      precedence: precedence ?? 100,
      roleArn: groupRole.roleArn,
    });
    groupRoleMapping.set(group, groupRole);
  }

  private _getEndpoints(apiEndpointArns: Map<string, string>, paths: string[]): string[] {
    const endpoints = paths
      .map((path) => apiEndpointArns.get(path))
      .filter((endpoint): endpoint is string => endpoint !== null);
    assert(endpoints.length == paths.length);
    return endpoints;
  }

  // Store the user pool id and client id in the parameter store so that we can verify
  // and decode tokens on the backend
  private _addCognitoInformationToSSM(userPoolId: string, userPoolClientId: string, region: string) {
    new StringParameter(this, 'user-pool-id-ssm-param', {
      parameterName: `/dea/${region}/userpool-id-param`,
      stringValue: userPoolId,
      description: 'stores the user pool id for use in token verification on the backend',
      tier: ParameterTier.STANDARD,
      allowedPattern: '.*',
    });

    new StringParameter(this, 'user-pool-client-id-ssm-param', {
      parameterName: `/dea/${region}/userpool-client-id-param`,
      stringValue: userPoolClientId,
      description: 'stores the user pool client id for use in token verification on the backend',
      tier: ParameterTier.STANDARD,
      allowedPattern: '.*',
    });
  }
}
