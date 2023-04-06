/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { assert } from 'console';
import * as fs from 'fs';
import { RoleMappingMatchType } from '@aws-cdk/aws-cognito-identitypool-alpha';
import { CfnParameter, Duration } from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import {
  AccountRecovery,
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
  ProviderAttribute,
  StringAttribute,
  UserPool,
  UserPoolClient,
  UserPoolDomain,
  UserPoolIdentityProviderSaml,
  UserPoolIdentityProviderSamlMetadata,
} from 'aws-cdk-lib/aws-cognito';
import {
  Effect,
  FederatedPrincipal,
  Policy,
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
} from 'aws-cdk-lib/aws-iam';
import { ParameterTier, StringListParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { createCfnOutput } from './construct-support';

interface DeaAuthProps {
  readonly restApi: RestApi;
  // We need to create IAM Roles with what APIs the Role can call
  // therefore we need the API endpoint ARNs from the API Gateway construct
  apiEndpointArns: Map<string, string>;
}

export class DeaAuthConstruct extends Construct {
  public constructor(scope: Construct, stackName: string, props: DeaAuthProps) {
    super(scope, stackName);

    const region = deaConfig.region();
    const loginUrl = `${props.restApi.url}ui/login`;

    // Auth Stack. Used to determine which APIs a user can access by assigning them
    // an IAM Role based on the DEARole specified by the Agency IdP during federation.
    // E.g. User federates with the auth stack, given credentials based on the DEARole in the id Token
    // and the role mapping in the Identity Pool, then user can call APIs as neccessary.
    // A Cognito UserPool will be used as the token vendor, and will ONLY be used
    // for federation with the Agency IdP. During federation, Cognito receives
    // a SAML assertion from the IdP, and uses it attached attribute mapping
    // to update the user. In particular, one field will be called DEARole, which
    // is a custom attribute and will be used during authorization to determine
    // the credentials for the user.
    // For production deployments, follow the ImplementationGuide on how to setup
    // and connect your existing CJIS-compatible IdP for SSO and attribute mapping for the UserPool
    // and role mapping rules for the identity pool for authorization
    this._createAuthStack(props.apiEndpointArns, loginUrl, region);
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
    const endpointstatment = new PolicyStatement({
      actions: ['execute-api:Invoke'],
      resources: apiEndpoints,
    });
    endpointstatment.effect = Effect.DENY;
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

  // Here is where we take the IAM Roles from the configuration file
  // and create them. These roles only define the DEA API endpoints
  // the user can use when granted the credentials.
  // During the authorization process, the client sends the the IdToken from
  // the authentication process, sends it to the /credentials DEA endpoint
  // which then sends it to the IdentityPool to get the appropriate credentials
  // for the user. To determine the credentials, the DEARole field in the
  // identity token is used and compared to the identity pool attached role mapping.
  // Thus from this function we send a mapping of DEARole values to the appropriate
  // IAM Role, which we will use to define the role mapping in cdk for the ID Pool.
  private _createDEARoles(
    apiEndpointArns: Map<string, string>,
    userPoolId: string,
    identityPoolId: string,
    region: string,
    stage: string
  ): Map<string, Role> {
    // Create IAM Roles that define what APIs are allowed to be called
    // The groups we create {Auditor, CaseWorker, Admin} are just examples
    // so customize to your agency's specific needs

    const principal = new WebIdentityPrincipal('cognito-identity.amazonaws.com', {
      StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPoolId },
      'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
    });

    const deaRolesMap = new Map<string, Role>();

    // 3 General Groups:
    // * Admins: can call APIs to change system settings like re-assign case, or list all cases
    // * Auditors: can call Audit APIs to generate reports
    // * Case Workers: can create cases, and upload/download to cases they have permissions to (case ACL)

    const deaRoleTypes = deaConfig.deaRoleTypes();
    deaRoleTypes.forEach((roleType) => {
      const endpointStrings = roleType.endpoints.map((endpoint) => `${endpoint.path}${endpoint.method}`);
      const groupEndpoints = this._getEndpoints(apiEndpointArns, endpointStrings);
      this._createDEARole(roleType.name, roleType.description, deaRolesMap, groupEndpoints, principal);
      new StringListParameter(this, `${roleType.name}_actions`, {
        parameterName: `/dea/${region}/${stage}-${roleType.name}-actions`,
        stringListValue: endpointStrings,
        description: 'stores the available endpoints for a role',
        tier: ParameterTier.STANDARD,
        allowedPattern: '.*',
      });
    });

    /* 
     * Commented out to avoid cdk the deployment failure due the max quota limit of 25 rules for RBAC reached.
    if (deaConfig.isTestStack()) {
      // create roles for individual endpoint allow/deny testing
      deaApiRouteConfig.routes.forEach((route) => {
        if (route.authMethod != AuthorizationType.NONE) {
          const arn = apiEndpointArns.get(`${route.path}${route.httpMethod}`);

          this._createDEARole(
            `AllowDenyTest_${route.eventName}`,
            `${route.httpMethod}_${route.path}`,
            deaRolesMap,
            [arn ?? ''],
            principal
          );
        }
      });
    }
    */

    return deaRolesMap;
  }

  private _createAuthStack(apiEndpointArns: Map<string, string>, callbackUrl: string, region: string): void {
    // See Implementation Guide for how to integrate your existing
    // Identity Provider with Cognito User Pool for SSO
    const [pool, poolClient, cognitoDomainUrl] = this._createCognitoIdP(callbackUrl, region);

    const providerUrl = `cognito-idp.${region}.amazonaws.com/${pool.userPoolId}:${poolClient.userPoolClientId}`;

    const idPool = new CfnIdentityPool(this, 'DEAIdentityPool', {
      allowUnauthenticatedIdentities: false,
      allowClassicFlow: false,
      cognitoIdentityProviders: [
        {
          providerName: pool.userPoolProviderName,
          serverSideTokenCheck: true,
          clientId: poolClient.userPoolClientId,
        },
      ],
    });

    // Create the DEA IAM Roles
    // Then tell the IdPool to map the DEARole field from the id token
    // to the appropriate DEA IAM Role
    const deaRoles: Map<string, Role> = this._createDEARoles(
      apiEndpointArns,
      pool.userPoolId,
      idPool.ref,
      region,
      deaConfig.stage()
    );
    const rules: CfnIdentityPoolRoleAttachment.MappingRuleProperty[] = new Array(deaRoles.size);
    Array.from(deaRoles.entries()).forEach((entry) => {
      rules.push({
        claim: 'custom:DEARole',
        value: entry[0],
        matchType: RoleMappingMatchType.EQUALS,
        roleArn: entry[1].roleArn,
      });
    });
    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolCognitoRoleAttachment', {
      identityPoolId: idPool.ref,
      roleMappings: {
        roleMappingsKey: {
          type: 'Rules',
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

    createCfnOutput(this, 'identityPoolId', {
      value: idPool.ref,
    });

    createCfnOutput(this, 'userPoolId', {
      value: pool.userPoolId,
    });

    createCfnOutput(this, 'poolProviderUrl', {
      value: pool.userPoolProviderUrl,
    });

    createCfnOutput(this, 'userPoolClientId', {
      value: poolClient.userPoolClientId,
    });

    // Add the user pool id and client id to SSM for use in the backend for verifying and decoding tokens
    this._addCognitoInformationToSSM(
      pool.userPoolId,
      poolClient.userPoolClientId,
      cognitoDomainUrl,
      callbackUrl,
      idPool.ref,
      region
    );
  }

  // TODO add function for creating the IAM SAML IdP, which
  // describes the external IdP and establishes trust between it and
  // AWS, so that it can be used in DEA. This SAML ARN will be used
  // for federation with the Cognito User Pool

  // We use CognitoUserPool as the IdP for the reference application
  // For production, the Cognito will simply act as a token vendor
  // and ONLY allow federation, no native auth
  // TODO: determine if Cognito is CJIS compatible
  private _createCognitoIdP(callbackUrl: string, region: string): [UserPool, UserPoolClient, string] {
    const tempPasswordValidity = Duration.days(1);
    // must re-authenticate in every 12 hours
    // Note when inactive for 30+ minutes, you will also have to reauthenticate
    // due to session lock requirements. This is handled by session management code
    // IdToken validity is max 1 hour for federated users
    const accessTokenValidity = Duration.hours(12);
    const idTokenValidity = Duration.hours(1);
    const refreshTokenValidity = Duration.hours(12);

    const userPool = new UserPool(this, 'DEAUserPool', {
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
        Also only want users in the agency IdP to be able to authenticate*/
      selfSignUpEnabled: false,
      customAttributes: {
        // NOTE for a user pool attribute that is mapped to
        // an IdP atribute, mutable must be set to true, otherwise
        // Cognito will throw an error during federation
        DEARole: new StringAttribute({ mutable: true }),
      },
      standardAttributes: {
        familyName: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
      },
      userInvitation: {
        emailSubject: 'Digital Evidence Archive Signup Invitation',
        emailBody: 'Hello {username}, you have been invited to use DEA! Your temporary password is {####}',
        smsMessage: 'Hello {username}, your temporary password for our DEA is {####}',
      },
      removalPolicy: deaConfig.retainPolicy(),
    });

    let domainPrefix = deaConfig.cognitoDomain();

    // The idea here is to use DOMAIN_PREFIX env as we do development, each of us setting a unique name locally.
    // For the one click generation we will not specify a prefix and thus the template will be generated with a parameter to be entered at deploy time
    if (!domainPrefix) {
      const cognitoPrefixParam = new CfnParameter(this, 'CognitoDomainPrefix', {
        type: 'String',
        description: 'The prefix of the cognito domain to associate to the user pool',
      });
      domainPrefix = cognitoPrefixParam.valueAsString;
    }

    const newDomain = new UserPoolDomain(this, domainPrefix, {
      userPool,
      cognitoDomain: {
        domainPrefix,
      },
    });

    userPool.addDomain('CognitoDomain', {
      cognitoDomain: {
        domainPrefix: newDomain.domainName,
      },
    });

    const callbackUrls = [callbackUrl];
    if (deaConfig.isTestStack()) {
      // test stacks add localhost as a callback url for UI redirect during local development
      callbackUrls.push(`http://localhost:3000/${deaConfig.stage()}/ui/login`);

      const authTestUrl = callbackUrl.replace('/login', '/auth-test');
      callbackUrls.push(authTestUrl);
    }

    // If external IDP information was provided in the config,
    // integrate it into the user pool here
    const idpInfo = deaConfig.idpMetadata();
    if (idpInfo && idpInfo.metadataPath) {
      const idpSamlMetadata = this._createIdpSAMLMetadata(idpInfo.metadataPath, idpInfo.metadataPathType);
      const idp = new UserPoolIdentityProviderSaml(this, 'AgencyIdP', {
        metadata: idpSamlMetadata,
        userPool: userPool,
        attributeMapping: {
          preferredUsername: ProviderAttribute.other(idpInfo.attributeMap.username),
          email: ProviderAttribute.other(idpInfo.attributeMap.email),
          familyName: ProviderAttribute.other(idpInfo.attributeMap.lastName),
          givenName: ProviderAttribute.other(idpInfo.attributeMap.firstName),
          custom: {
            'custom:DEARole': ProviderAttribute.other(idpInfo.attributeMap.deaRoleName),
          },
        },
      });

      // Put the name of the IdP in SSM so the hosted UI can automaticaly redirect to the IdP Signin page
      const stage = deaConfig.stage();
      new StringParameter(this, 'agency-idp-name', {
        parameterName: `/dea/${region}/${stage}-agency-idp-name`,
        stringValue: idp.providerName,
        description: 'stores the agency idp name for redirection during login with hosted ui',
        tier: ParameterTier.STANDARD,
        allowedPattern: '.*',
      });
    }

    const poolClient = userPool.addClient('dea-app-client', {
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
        callbackUrls,
        flows: {
          authorizationCodeGrant: true,
        },
      },

      preventUserExistenceErrors: true,
      refreshTokenValidity: refreshTokenValidity,
      userPoolClientName: 'dea-app-client',
    });

    return [userPool, poolClient, newDomain.baseUrl()];
  }

  private _createDEARole(
    name: string,
    desc: string,
    deaRolesMap: Map<string, Role>,
    endpoints: string[],
    principal: WebIdentityPrincipal
  ): void {
    const deaRole = this._createIamRole(`${name}Role`, `Role ${desc}`, endpoints, principal);
    deaRolesMap.set(name, deaRole);
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
  private _addCognitoInformationToSSM(
    userPoolId: string,
    userPoolClientId: string,
    cognitoDomain: string,
    callbackUrl: string,
    identityPoolId: string,
    region: string
  ) {
    const stage = deaConfig.stage();
    new StringParameter(this, 'user-pool-id-ssm-param', {
      parameterName: `/dea/${region}/${stage}-userpool-id-param`,
      stringValue: userPoolId,
      description: 'stores the user pool id for use in token verification on the backend',
      tier: ParameterTier.STANDARD,
      allowedPattern: '.*',
    });

    new StringParameter(this, 'user-pool-client-id-ssm-param', {
      parameterName: `/dea/${region}/${stage}-userpool-client-id-param`,
      stringValue: userPoolClientId,
      description: 'stores the user pool client id for use in token verification on the backend',
      tier: ParameterTier.STANDARD,
      allowedPattern: '.*',
    });

    new StringParameter(this, 'user-pool-cognito-domain-ssm-param', {
      parameterName: `/dea/${region}/${stage}-userpool-cognito-domain-param`,
      stringValue: cognitoDomain,
      description: 'stores the user pool cognito domain for use in token verification on the backend',
      tier: ParameterTier.STANDARD,
      allowedPattern: '.*',
    });

    new StringParameter(this, 'identity-pool-id-ssm-param', {
      parameterName: `/dea/${region}/${stage}-identity-pool-id-param`,
      stringValue: identityPoolId,
      description: 'stores the identity pool id for use in user verification on the backend',
      tier: ParameterTier.STANDARD,
      allowedPattern: '.*',
    });

    new StringParameter(this, 'client-callback-url-ssm-param', {
      parameterName: `/dea/${region}/${stage}-client-callback-url-param`,
      stringValue: callbackUrl,
      description: 'stores the app client callback url for use in token verification on the backend',
      tier: ParameterTier.STANDARD,
      allowedPattern: '.*',
    });
  }

  private _createIdpSAMLMetadata(path: string, pathType: string): UserPoolIdentityProviderSamlMetadata {
    if (pathType === 'URL') {
      return UserPoolIdentityProviderSamlMetadata.url(path);
    }

    // else its a file, read in the contents from the file
    const fileContent = fs.readFileSync(path, 'utf-8');
    return UserPoolIdentityProviderSamlMetadata.file(fileContent);
  }
}
