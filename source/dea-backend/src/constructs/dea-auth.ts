/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { assert } from 'console';
import * as fs from 'fs';
import path from 'path';
import { RoleMappingMatchType } from '@aws-cdk/aws-cognito-identitypool-alpha';
import {
  Aws,
  CfnCondition,
  CfnJson,
  CfnParameter,
  Duration,
  Fn,
  SecretValue,
  Stack,
  StackProps,
} from 'aws-cdk-lib';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';
import {
  AccountRecovery,
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
  ClientAttributes,
  ProviderAttribute,
  StringAttribute,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolDomain,
  UserPoolIdentityProviderSaml,
  UserPoolIdentityProviderSamlMetadata,
  UserPoolTriggers,
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
import { Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { createCfnOutput } from './construct-support';
import { DeaOperationalDashboard } from './dea-ops-dashboard';

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
  opsDashboard?: DeaOperationalDashboard;
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
    if (!deaConfig.isOneClick()) {
      super(scope, stackName, {
        ...props,
        env: {
          ...props?.env,
          region: deaProps.region, // Note: for us-gov-east-1, we change the region
          // to us-gov-west-1 since Cognito is not available in that region
        },
        crossRegionReferences: true,
      });
    } else {
      super(scope, stackName, props);
    }

    this.deaAuthInfo = new DeaAuth(this, stackName, deaProps).deaAuthInfo;
  }
}

export class DeaAuth extends Construct {
  public deaAuthInfo: DeaAuthInfo;

  public constructor(scope: Construct, stackName: string, deaProps: DeaAuthProps) {
    super(scope, stackName + 'Construct');

    let loginUrl = `${deaProps.restApi.url}ui/login`;
    const customDomainInfo = deaConfig.customDomainInfo();
    if (customDomainInfo.domainName && customDomainInfo.certificateArn) {
      loginUrl = `https://${customDomainInfo.domainName}/ui/login`;
    }

    // Auth Stack. Used to determine which APIs a user can access by assigning them
    // an IAM Role based on the group membership to DEARole mapping specified by the Agency IdP during federation.
    // E.g. User federates with the auth stack, given credentials based on the group membership in the id Token
    // and the role mapping in the Identity Pool, then user can call APIs as neccessary.
    // A Cognito UserPool will be used as the token vendor, and will ONLY be used
    // for federation with the Agency IdP. During federation, Cognito receives
    // a SAML assertion from the IdP, and uses its attached attribute mapping
    // to update the user. In particular, one field will be called SAMLGroups, which
    // is a list of groups memberships in the external IDP and will be used during authorization to determine
    // the credentials for the user. (In the configuration file map the group names to desired DEARole)
    // For production deployments, follow the ImplementationGuide on how to setup
    // and connect your existing CJIS-compatible IdP for SSO and attribute mapping for the UserPool
    // and role mapping rules for the identity pool for authorization
    this.deaAuthInfo = this.createAuthStack(deaProps.apiEndpointArns, loginUrl, deaProps.opsDashboard);
  }

  private createIamRole(
    roleName: string,
    description: string,
    apiEndpoints: Array<string>,
    principal: WebIdentityPrincipal,
    roleBoundary: ManagedPolicy
  ): Role {
    const stage = deaConfig.stage();
    const role = new Role(this, roleName, {
      assumedBy: principal,
      description: description,
      roleName: `${stage}-${roleName}`,
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
  // for the user. To determine the credentials, the SAMLGroups field in the
  // identity token is used and compared to the identity pool attached role mapping.
  // Thus from this function we send a mapping of groups (using regex) values to the appropriate
  // IAM Role, which we will use to define the role mapping in cdk for the ID Pool.
  private createDEARoles(
    apiEndpointArns: Map<string, string>,
    identityPoolId: string,
    isUsGovConditionId: string
  ): [Map<string, Role>, Map<string, string[]>] {
    // Create IAM Roles that define what APIs are allowed to be called
    // The role we create {Auditor, CaseWorker, Admin} are just examples
    // so customize to your agency's specific needs

    const cognitoPartition = Fn.conditionIf(
      isUsGovConditionId,
      'cognito-identity-us-gov',
      'cognito-identity'
    ).toString();
    const audConditionString = `${cognitoPartition}.amazonaws.com:aud`;
    const amrConditionString = `${cognitoPartition}.amazonaws.com:amr`;
    const audJson = new CfnJson(this, 'AudJson', {
      value: {
        [audConditionString]: identityPoolId,
      },
    });
    const amrJson = new CfnJson(this, 'AmrJson', {
      value: { [amrConditionString]: 'authenticated' },
    });

    const principal = new WebIdentityPrincipal(`${cognitoPartition}.amazonaws.com`, {
      StringEquals: audJson,
      'ForAnyValue:StringLike': amrJson,
    });

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
    opsDashboard?: DeaOperationalDashboard
  ): DeaAuthInfo {
    const usGovCondition = new CfnCondition(this, 'isUSGov', {
      expression: Fn.conditionEquals(Aws.PARTITION, 'aws-us-gov'),
    });
    // See Implementation Guide for how to integrate your existing
    // Identity Provider with Cognito User Pool for SSO
    const [pool, poolClient, cognitoDomainUrl, clientSecret, agencyIdpName] = this.createCognitoIdP(
      callbackUrl,
      opsDashboard
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
    const [deaRoles, availableEndpointsPerRole] = this.createDEARoles(
      apiEndpointArns,
      idPool.ref,
      usGovCondition.logicalId
    );
    let rules: CfnIdentityPoolRoleAttachment.MappingRuleProperty[];
    const idpInfo = deaConfig.idpMetadata();
    // If the user has defined rules, use that to generate the rule mapping
    if (idpInfo && idpInfo.groupToDeaRoleRules.length > 0) {
      const groupToDeaRoleRules = idpInfo.groupToDeaRoleRules;
      rules = new Array(groupToDeaRoleRules.length);
      groupToDeaRoleRules.forEach((ruleMapping) => {
        const roleArn = deaRoles.get(ruleMapping.deaRoleName)?.roleArn;
        if (!roleArn) {
          throw new Error(
            `Malformed Rule Mapping: DeaRole Name ${ruleMapping.deaRoleName} is not a valid dea role`
          );
        }
        rules.push({
          claim: 'custom:SAMLGroups',
          value: ruleMapping.filterValue,
          matchType: RoleMappingMatchType.CONTAINS,
          roleArn,
        });
      });
    } else {
      // Rely on assigned DEARole based on DEA attribute
      rules = new Array(deaRoles.size);
      Array.from(deaRoles.entries()).forEach((entry) => {
        rules.push({
          claim: 'custom:DEARole',
          value: entry[0],
          matchType: RoleMappingMatchType.EQUALS,
          roleArn: entry[1].roleArn,
        });
      });
    }

    let defaultRoleArn;
    if (idpInfo?.defaultRole) {
      const defaultRoleArn = deaRoles.get(idpInfo.defaultRole)?.roleArn;
      if (!defaultRoleArn) {
        throw new Error(`Default Role is an invalid DeaRole Name ${idpInfo.defaultRole}`);
      }
    }
    const { authenticated, unauthenticated } = this._createIdPoolDefaultRoles(
      idPool.ref,
      usGovCondition.logicalId,
      defaultRoleArn
    );
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
    opsDashboard?: DeaOperationalDashboard
  ): [UserPool, UserPoolClient, string, SecretValue, string?] {
    const tempPasswordValidity = Duration.days(1);
    // must re-authenticate in every 12 hours (so we make expiry 11 hours, so they can't refresh at 11:59)
    // Note when inactive for 30+ minutes, you will also have to reauthenticate
    // due to session lock requirements. This is handled by session management code
    // IdToken validity is 1 hour for federated users no matter what you set it to
    const accessTokenValidity = Duration.hours(1);
    const idTokenValidity = Duration.hours(1);
    const refreshTokenValidity = Duration.hours(11);

    // If the external IdP used in Identity Center, create the PreTokenGeneration Trigger
    // Lambda and add it to the user pool triggers.
    // This is a special case since Identity Center can't send groups or a custom attribute
    // over the SAML assertion, so the trigger queries the users groups and adds it to the token
    // so authorization can proceed as normal
    let lambdaTriggers: UserPoolTriggers | undefined;
    const idpMetadata = deaConfig.idpMetadata();
    const identityStoreId = idpMetadata?.identityStoreId;
    const identityStoreRegion = idpMetadata?.identityStoreRegion;
    if (identityStoreId) {
      if (!identityStoreRegion) {
        throw new Error('Config identityStoreRegion is required when using Identity Store');
      }

      const preTokenGenerationLambda = this.createPreTokenGenerationLambda(
        identityStoreId,
        identityStoreRegion,
        opsDashboard
      );
      lambdaTriggers = { preTokenGeneration: preTokenGenerationLambda };
    }

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
        SAMLGroups: new StringAttribute({ mutable: true }),
        DEARole: new StringAttribute({ mutable: true }),
        IdCenterId: new StringAttribute({ mutable: true }),
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
      lambdaTriggers,
    });

    let domainPrefix = deaConfig.cognitoDomain();

    // The idea here is to use DOMAIN_PREFIX env as we do development, each of us setting a unique name locally.
    // For the one click generation we will not specify a prefix and thus the template will be generated with a parameter to be entered at deploy time
    if (!domainPrefix) {
      const cognitoPrefixParam = new CfnParameter(this, 'CognitoDomainPrefix', {
        type: 'String',
        description:
          "The prefix of the cognito domain to associate to the user pool. Domain prefixes may only include lowercase, alphanumeric characters, and hyphens. You can't use the text aws, amazon, or cognito in the domain prefix. Your domain prefix must be unique within the current Region.",
        allowedPattern: '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$',
      });
      domainPrefix = cognitoPrefixParam.valueAsString;
    }

    const newDomain = new UserPoolDomain(this, 'dea-user-pool-domain', {
      userPool,
      cognitoDomain: {
        domainPrefix,
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
    let supportedIdentityProviders: UserPoolClientIdentityProvider[] | undefined;
    if (idpInfo && idpInfo.metadataPath) {
      let idp: UserPoolIdentityProviderSaml;
      // Identity Center has to be treated differently because it cannot send groups
      // or a custom attribute over the wire
      if (idpInfo.identityStoreId) {
        if (!idpInfo.attributeMap.idcenterid) {
          throw new Error(
            'When integrating with Identity Center, you must add idcenterid to your attribute mapping'
          );
        }
        const idpSamlMetadata = this.createIdpSAMLMetadata(idpInfo.metadataPath, idpInfo.metadataPathType);
        idp = new UserPoolIdentityProviderSaml(this, 'AgencyIdP', {
          metadata: idpSamlMetadata,
          userPool: userPool,
          attributeMapping: {
            preferredUsername: ProviderAttribute.other(idpInfo.attributeMap.username),
            email: ProviderAttribute.other(idpInfo.attributeMap.email),
            familyName: ProviderAttribute.other(idpInfo.attributeMap.lastName),
            givenName: ProviderAttribute.other(idpInfo.attributeMap.firstName),
            custom: {
              'custom:IdCenterId': ProviderAttribute.other(idpInfo.attributeMap.idcenterid),
            },
          },
        });
      } else {
        let custom;
        // Determine which attributes are being sent via SAML from the IDP
        // Must be at least 1, can be both.
        if (idpInfo.attributeMap.deaRoleName && idpInfo.attributeMap.groups) {
          custom = {
            'custom:DEARole': ProviderAttribute.other(idpInfo.attributeMap.deaRoleName),
            'custom:SAMLGroups': ProviderAttribute.other(idpInfo.attributeMap.groups),
          };
        } else if (idpInfo.attributeMap.groups) {
          // Check that the rule mapping rules are assigned
          if (!idpInfo.groupToDeaRoleRules) {
            throw new Error('Must define Rule Mappings when using Groups Attribute for authorization');
          }
          custom = {
            'custom:SAMLGroups': ProviderAttribute.other(idpInfo.attributeMap.groups),
          };
        } else if (idpInfo.attributeMap.deaRoleName) {
          custom = {
            'custom:DEARole': ProviderAttribute.other(idpInfo.attributeMap.deaRoleName),
          };
        }
        const idpSamlMetadata = this.createIdpSAMLMetadata(idpInfo.metadataPath, idpInfo.metadataPathType);
        idp = new UserPoolIdentityProviderSaml(this, 'AgencyIdP', {
          metadata: idpSamlMetadata,
          userPool: userPool,
          attributeMapping: {
            preferredUsername: ProviderAttribute.other(idpInfo.attributeMap.username),
            email: ProviderAttribute.other(idpInfo.attributeMap.email),
            familyName: ProviderAttribute.other(idpInfo.attributeMap.lastName),
            givenName: ProviderAttribute.other(idpInfo.attributeMap.firstName),
            custom,
          },
        });
      }

      // Will be placed in SSM so the hosted UI can automaticaly redirect to the IdP Signin page
      agencyIdpName = idp.providerName;
      supportedIdentityProviders = [UserPoolClientIdentityProvider.custom(agencyIdpName)];
    }

    const clientWriteAttributes = new ClientAttributes()
      .withStandardAttributes({
        familyName: true,
        givenName: true,
        email: true,
        preferredUsername: true,
        lastUpdateTime: true,
      })
      .withCustomAttributes('SAMLGroups', 'DEARole', 'IdCenterId');
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
      supportedIdentityProviders,
      writeAttributes: clientWriteAttributes,
    });

    const cognitoDomain =
      deaConfig.partition() === 'aws-us-gov'
        ? `https://${newDomain.domainName}.auth-fips.us-gov-west-1.amazoncognito.com`
        : newDomain.baseUrl({ fips: deaConfig.fipsEndpointsEnabled() });

    return [userPool, poolClient, cognitoDomain, poolClient.userPoolClientSecret, agencyIdpName];
  }

  private createPreTokenGenerationLambda(
    identityStoreId: string,
    identityStoreRegion: string,
    opsDashboard?: DeaOperationalDashboard
  ): NodejsFunction {
    const lambda = new NodejsFunction(this, `${deaConfig.stage()}-PreTokenGenerationTrigger`, {
      memorySize: 512,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(60),
      runtime: Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/handlers/add-groups-claim-to-token-handler.ts'),
      depsLockFilePath: path.join(__dirname, '../../../common/config/rush/pnpm-lock.yaml'),
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        IDENTITY_STORE_ID: identityStoreId,
        IDENTITY_STORE_REGION: identityStoreRegion,
      },
      bundling: {
        externalModules: ['aws-sdk'],
        minify: true,
        sourceMap: true,
      },
    });

    lambda.addToRolePolicy(
      new PolicyStatement({
        actions: ['identitystore:ListGroupMembershipsForMember', 'identitystore:DescribeGroup'],
        resources: [
          `arn:${Aws.PARTITION}:identitystore::${Aws.ACCOUNT_ID}:identitystore/${identityStoreId}`,
          `arn:${Aws.PARTITION}:identitystore:::membership/*`,
          `arn:${Aws.PARTITION}:identitystore:::user/*`,
          `arn:${Aws.PARTITION}:identitystore:::group/*`,
          `arn:${Aws.PARTITION}:identitystore::${Aws.ACCOUNT_ID}:identitystore/${identityStoreId}`,
        ],
      })
    );

    opsDashboard?.addPreTokenGenerationTriggerLambdaErrorAlarm(lambda, 'PreTokenGenerationTriggerLambda');
    return lambda;
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
    isUsGovConditionId: string,
    defaultRoleArn?: string
  ): { authenticated: string; unauthenticated: string } {
    const cognitoPartition = Fn.conditionIf(
      isUsGovConditionId,
      'cognito-identity-us-gov',
      'cognito-identity'
    ).toString();
    const audConditionString = `${cognitoPartition}.amazonaws.com:aud`;
    const amrConditionString = `${cognitoPartition}.amazonaws.com:amr`;
    const audJson = new CfnJson(this, 'DefaultAudJson', {
      value: {
        [audConditionString]: idPoolRef,
      },
    });
    const amrJson = new CfnJson(this, 'DefaultAmrJson', {
      value: { [amrConditionString]: 'authenticated' },
    });
    const amrUnauthJson = new CfnJson(this, 'DefaultUnauthAmrJson', {
      value: { [amrConditionString]: 'unauthenticated' },
    });

    const authenticated = defaultRoleArn
      ? defaultRoleArn
      : new Role(this, 'IdPoolAuthenticatedRole', {
          assumedBy: new FederatedPrincipal(
            `${cognitoPartition}.amazonaws.com`,
            {
              StringEquals: audJson,
              'ForAnyValue:StringLike': amrJson,
            },
            'sts:AssumeRoleWithWebIdentity'
          ),
        }).roleArn;

    const unauthenticated = new Role(this, 'IdPoolUnAuthenticatedRole', {
      assumedBy: new FederatedPrincipal(
        `${cognitoPartition}.amazonaws.com`,
        {
          StringEquals: audJson,
          'ForAnyValue:StringLike': amrUnauthJson,
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    }).roleArn;

    return { authenticated, unauthenticated };
  }
}
