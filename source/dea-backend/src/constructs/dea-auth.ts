/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { assert } from 'console';
import * as fs from 'fs';
import { RoleMappingMatchType } from '@aws-cdk/aws-cognito-identitypool-alpha';
import { CfnParameter, Duration, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
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
  ManagedPolicy,
  PermissionsBoundary,
  Policy,
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { createCfnOutput } from './construct-support';

// Gov Region us-gov-east-1 does NOT have Cognito
// therefore for that region we will launch the Cognito UserPool and IdPool
// in us-gov-west-1, and the rest of dea in us-gov-east-1.
// This may lead to higher latencies, due to regional network travel.
// This class MAY ONLY contain Cognito constructs, because when launching
// in us-gov-east-1, we do a 2-phase deployment, the first with Cognito
// in gov-west, then the rest. To do that, we launch only this construct,
// so whatever you place in here will also be deployed in us-gov-west-1
// IAM is fine since its an AWS global service for the account, not regional

// NOTE: Since CloudFormation is regional not global, we have to deploy
// cognito and the rest of DEA in different stacks for us-gov-east-1.
// However, we also have the requirement for OneClick, which requires that
// there be only ONE Cfn template. Obviously, Gov East will not be compatible
// for OneClick, but for the rest of the regions we need one template.
// Therefore, for the normal case we will use DeaAuth as a construct
// and for us-gov-east-1, we will use it as a Stack. Its hacky, but we get
// the best of both worlds; OneClick for everything else, and a single deployment
// for us-gov-east-1

interface DeaAuthProps {
  readonly region: string;
  readonly restApi: RestApi;
  // We need to create IAM Roles with what APIs the Role can call
  // therefore we need the API endpoint ARNs from the API Gateway construct
  apiEndpointArns: Map<string, string>;
}

export interface DeaAuthInfo {
  readonly availableEndpointsPerRole: Map<string, string[]>;
  readonly userPoolId: string;
  readonly userPoolClientId: string;
  readonly cognitoDomain: string;
  readonly callbackUrl: string;
  readonly identityPoolId: string;
  readonly clientSecret: SecretValue;
  readonly agencyIdpName?: string;
}

export class DeaAuthStack extends Stack {
  public deaAuthInfo: DeaAuthInfo;

  public constructor(scope: Construct, stackName: string, deaProps: DeaAuthProps, props?: StackProps) {
    super(scope, stackName, {
      ...props,
      env: {
        ...props?.env,
        region: deaProps.region, // Note: for us-gov-east-1, we change the region
        // to us-gov-west-1 since Cognito is not available in that region
      },
      crossRegionReferences: true,
    });

    this.deaAuthInfo = new DeaAuth(this, 'DeaAuth', deaProps).deaAuthInfo;
  }
}

export class DeaAuth extends Construct {
  public deaAuthInfo: DeaAuthInfo;

  public constructor(scope: Construct, stackName: string, deaProps: DeaAuthProps) {
    super(scope, stackName + 'Construct');

    const loginUrl = `${deaProps.restApi.url}ui/login`;

    const partition = deaConfig.partition();

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
    this.deaAuthInfo = this.createAuthStack(deaProps.apiEndpointArns, loginUrl, partition);
  }

  private createIamRole(
    roleName: string,
    description: string,
    apiEndpoints: Array<string>,
    principal: WebIdentityPrincipal,
    roleBoundary: ManagedPolicy
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
    PermissionsBoundary.of(role).apply(roleBoundary);

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
  private createDEARoles(
    apiEndpointArns: Map<string, string>,
    identityPoolId: string,
    partition: string
  ): [Map<string, Role>, Map<string, string[]>] {
    // Create IAM Roles that define what APIs are allowed to be called
    // The role we create {Auditor, CaseWorker, Admin} are just examples
    // so customize to your agency's specific needs

    let principal: WebIdentityPrincipal;
    if (partition === 'aws-us-gov') {
      principal = new WebIdentityPrincipal('cognito-identity-us-gov.amazonaws.com', {
        StringEquals: { 'cognito-identity-us-gov.amazonaws.com:aud': identityPoolId },
        'ForAnyValue:StringLike': { 'cognito-identity-us-gov.amazonaws.com:amr': 'authenticated' },
      });
    } else {
      principal = new WebIdentityPrincipal('cognito-identity.amazonaws.com', {
        StringEquals: { 'cognito-identity.amazonaws.com:aud': identityPoolId },
        'ForAnyValue:StringLike': { 'cognito-identity.amazonaws.com:amr': 'authenticated' },
      });
    }

    const deaRolesMap = new Map<string, Role>();
    const availableEndpointsPerRole = new Map<string, string[]>();

    // 3 General Roles:
    // * Admins: can call APIs to change system settings like re-assign case, or list all cases
    // * Auditors: can call Audit APIs to generate reports
    // * Case Workers: can create cases, and upload/download to cases they have permissions to (case ACL)

    const roleBoundary = new ManagedPolicy(this, 'deaRoleBoundary', {
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['execute-api:Invoke'],
          resources: [...apiEndpointArns.values()],
        }),
      ],
    });

    const deaRoleTypes = deaConfig.deaRoleTypes();
    deaRoleTypes.forEach((roleType) => {
      const endpointStrings = roleType.endpoints.map((endpoint) => `${endpoint.path}${endpoint.method}`);
      const groupEndpoints = this.getEndpoints(apiEndpointArns, endpointStrings);
      this.createDEARole(
        roleType.name,
        roleType.description,
        deaRolesMap,
        groupEndpoints,
        principal,
        roleBoundary
      );
      availableEndpointsPerRole.set(roleType.name, endpointStrings);
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

    return [deaRolesMap, availableEndpointsPerRole];
  }

  private createAuthStack(
    apiEndpointArns: Map<string, string>,
    callbackUrl: string,
    partition: string
  ): DeaAuthInfo {
    // See Implementation Guide for how to integrate your existing
    // Identity Provider with Cognito User Pool for SSO
    const [pool, poolClient, cognitoDomainUrl, clientSecret, agencyIdpName] = this.createCognitoIdP(
      callbackUrl,
      partition
    );

    // For gov cloud, Cognito only uses FIPS endpoint, and the only FIPS endpoint
    // is in us-gov-west-1. See https://docs.aws.amazon.com/govcloud-us/latest/UserGuide/govcloud-cog.html
    // for more details

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
    const [deaRoles, availableEndpointsPerRole] = this.createDEARoles(apiEndpointArns, idPool.ref, partition);
    const rules: CfnIdentityPoolRoleAttachment.MappingRuleProperty[] = new Array(deaRoles.size);
    Array.from(deaRoles.entries()).forEach((entry) => {
      rules.push({
        claim: 'custom:DEARole',
        value: entry[0],
        matchType: RoleMappingMatchType.EQUALS,
        roleArn: entry[1].roleArn,
      });
    });

    const { authenticated, unauthenticated } = this._createIdPoolDefaultRoles(idPool.ref, partition);
    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolCognitoRoleAttachment', {
      identityPoolId: idPool.ref,
      roleMappings: {
        roleMappingsKey: {
          type: 'Rules',
          identityProvider: `${pool.userPoolProviderName}:${poolClient.userPoolClientId}`,
          ambiguousRoleResolution: 'AuthenticatedRole',
          rulesConfiguration: {
            rules: rules,
          },
        },
      },
      roles: {
        authenticated,
        unauthenticated,
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

    createCfnOutput(this, 'poolProviderName', {
      value: pool.userPoolProviderName,
    });

    createCfnOutput(this, 'userPoolClientId', {
      value: poolClient.userPoolClientId,
    });

    createCfnOutput(this, 'userPoolClientSecret', {
      value: poolClient.userPoolClientSecret.unsafeUnwrap(),
    });

    return {
      availableEndpointsPerRole,
      userPoolId: pool.userPoolId,
      userPoolClientId: poolClient.userPoolClientId,
      cognitoDomain: cognitoDomainUrl,
      callbackUrl,
      identityPoolId: idPool.ref,
      clientSecret,
      agencyIdpName,
    };
  }

  // TODO add function for creating the IAM SAML IdP, which
  // describes the external IdP and establishes trust between it and
  // AWS, so that it can be used in DEA. This SAML ARN will be used
  // for federation with the Cognito User Pool

  // We use CognitoUserPool as the IdP for the reference application
  // For production, the Cognito will simply act as a token vendor
  // and ONLY allow federation, no native auth
  // TODO: determine if Cognito is CJIS compatible
  private createCognitoIdP(
    callbackUrl: string,
    partition: string
  ): [UserPool, UserPoolClient, string, SecretValue, string?] {
    const tempPasswordValidity = Duration.days(1);
    // must re-authenticate in every 12 hours (so we make expiry 11 hours, so they can't refresh at 11:59)
    // Note when inactive for 30+ minutes, you will also have to reauthenticate
    // due to session lock requirements. This is handled by session management code
    // IdToken validity is max 1 hour for federated users
    const accessTokenValidity = Duration.hours(11);
    const idTokenValidity = Duration.hours(1);
    const refreshTokenValidity = Duration.hours(11);

    // fetch stage
    const stage = deaConfig.stage();

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
    deaConfig.deaAllowedOriginsList().forEach((origin) => {
      callbackUrls.push(`${origin}/${stage}/ui/login`);
    });

    if (deaConfig.isTestStack()) {
      const authTestUrl = callbackUrl.replace('/login', '/auth-test');
      callbackUrls.push(authTestUrl);
    }

    // If external IDP information was provided in the config,
    // integrate it into the user pool here
    const idpInfo = deaConfig.idpMetadata();
    let agencyIdpName: string | undefined;
    if (idpInfo && idpInfo.metadataPath) {
      const idpSamlMetadata = this.createIdpSAMLMetadata(idpInfo.metadataPath, idpInfo.metadataPathType);
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

      // Will be placed in SSM so the hosted UI can automaticaly redirect to the IdP Signin page
      agencyIdpName = idp.providerName;
    }

    const poolClient = userPool.addClient('dea-app-client', {
      accessTokenValidity: accessTokenValidity,
      // use Server-side authentication workflow
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
      },
      enableTokenRevocation: true,
      generateSecret: true,
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

    const cognitoDomain =
      partition === 'aws-us-gov'
        ? `https://${newDomain.domainName}.auth-fips.us-gov-west-1.amazoncognito.com`
        : newDomain.baseUrl({ fips: true });

    return [userPool, poolClient, cognitoDomain, poolClient.userPoolClientSecret, agencyIdpName];
  }

  private createDEARole(
    name: string,
    desc: string,
    deaRolesMap: Map<string, Role>,
    endpoints: string[],
    principal: WebIdentityPrincipal,
    roleBoundary: ManagedPolicy
  ): void {
    const deaRole = this.createIamRole(`${name}Role`, `Role ${desc}`, endpoints, principal, roleBoundary);
    deaRolesMap.set(name, deaRole);
  }

  private getEndpoints(apiEndpointArns: Map<string, string>, paths: string[]): string[] {
    const endpoints = paths
      .map((path) => apiEndpointArns.get(path))
      .filter((endpoint): endpoint is string => endpoint !== null);
    assert(endpoints.length == paths.length);
    return endpoints;
  }

  private createIdpSAMLMetadata(path: string, pathType: string): UserPoolIdentityProviderSamlMetadata {
    if (pathType === 'URL') {
      return UserPoolIdentityProviderSamlMetadata.url(path);
    }

    // else its a file, read in the contents from the file
    const fileContent = fs.readFileSync(path, 'utf-8');
    return UserPoolIdentityProviderSamlMetadata.file(fileContent);
  }

  private _createIdPoolDefaultRoles(
    idPoolRef: string,
    partition: string
  ): { authenticated: string; unauthenticated: string } {
    let authenticated: string;
    let unauthenticated: string;
    if (partition === 'aws-us-gov') {
      authenticated = new Role(this, 'IdPoolAuthenticatedRole', {
        assumedBy: new FederatedPrincipal(
          'cognito-identity-us-gov.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity-us-gov.amazonaws.com:aud': idPoolRef,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity-us-gov.amazonaws.com:amr': 'authenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      }).roleArn;

      unauthenticated = new Role(this, 'IdPoolUnAuthenticatedRole', {
        assumedBy: new FederatedPrincipal(
          'cognito-identity-us-gov.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity-us-gov.amazonaws.com:aud': idPoolRef,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity-us-gov.amazonaws.com:amr': 'unauthenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      }).roleArn;
    } else {
      authenticated = new Role(this, 'IdPoolAuthenticatedRole', {
        assumedBy: new FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': idPoolRef,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      }).roleArn;

      unauthenticated = new Role(this, 'IdPoolUnAuthenticatedRole', {
        assumedBy: new FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': idPoolRef,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'unauthenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      }).roleArn;
    }
    return { authenticated, unauthenticated };
  }
}
