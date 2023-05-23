/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { ParameterTier, StringListParameter, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { deaConfig } from '../config';
import { DeaAuthInfo } from './dea-auth';

/* This construct handles storing all the parameters and variables
   for DEA in either AWS SSM Param Store or SecretManager.
   For example, we store auth urls and variables, as well
   as available endpoints per role. */

// NOTE: Due to Cognito inavailability in us-gov-east-1, we have to deploy
// DEA in a parent stack and two nested stacks. One for the Auth stack
// and this DeaParameters (to break a dependency cycle b/w main and auth).
// In other regions, we need to have only one Cfn template for OneClick, so we'll
// deploy DeaAuth and DeaParameters as a construct.
// See comment in dea-auth for more context.

interface DeaParametersProps {
  readonly deaAuthInfo: DeaAuthInfo;
  readonly kmsKey: Key;
}

export class DeaParametersStack extends Stack {
  public constructor(
    scope: Construct,
    stackName: string,
    protectedDeaResourceArns: string[],
    deaProps: DeaParametersProps,
    props?: StackProps
  ) {
    super(scope, stackName, props);

    new DeaParameters(this, stackName, protectedDeaResourceArns, deaProps);
  }
}

export class DeaParameters extends Construct {
  public constructor(
    scope: Construct,
    stackName: string,
    protectedDeaResourceArns: string[],
    deaProps: DeaParametersProps
  ) {
    super(scope, stackName + 'Construct');

    const deaAuthInfo = deaProps.deaAuthInfo;

    // The front end will query for available endpoints for the user's role
    // to determine which buttons/functionality should be displayed/activated
    this.storeAvailableEndpointsPerRole(protectedDeaResourceArns, deaAuthInfo.availableEndpointsPerRole);

    // We store the client secret for Cognito in secrets manager
    // used in backend auth APIs for machine to machine communications with Cognito
    this.storeSecrets(protectedDeaResourceArns, deaAuthInfo.clientSecret, deaProps.kmsKey);

    // We need various cognito information during authentication/authorization
    // in DEA. Store that (excepting client secret) in SSM Param Store
    this.storeCognitoInformationInSSM(
      deaAuthInfo.userPoolId,
      deaAuthInfo.userPoolClientId,
      deaAuthInfo.cognitoDomain,
      deaAuthInfo.callbackUrl,
      deaAuthInfo.identityPoolId,
      deaAuthInfo.agencyIdpName
    );
  }

  private storeAvailableEndpointsPerRole(
    protectedDeaResourceArns: string[],
    availableEndpointsPerRole: Map<string, string[]>
  ) {
    const region = deaConfig.region();
    const stage = deaConfig.stage();
    availableEndpointsPerRole.forEach((endpointStrings: string[], roleName: string) => {
      const param = new StringListParameter(this, `${roleName}_actions`, {
        parameterName: `/dea/${region}/${stage}-${roleName}-actions`,
        stringListValue: endpointStrings,
        description: 'stores the available endpoints for a role',
        tier: ParameterTier.STANDARD,
        allowedPattern: '.*',
      });

      protectedDeaResourceArns.push(param.parameterArn);
    });
  }

  private storeSecrets(protectedDeaResourceArns: string[], clientSecret: SecretValue, kmsKey: Key) {
    const region = deaConfig.region();
    const stage = deaConfig.stage();
    const secret = new Secret(this, `/dea/${region}/${stage}/clientSecret`, {
      secretName: `/dea/${region}/${stage}/clientSecret`,
      encryptionKey: kmsKey,
      secretStringValue: clientSecret,
    });

    protectedDeaResourceArns.push(secret.secretArn);
  }

  // Store the user pool id and client id in the parameter store so that we can verify
  // and decode tokens on the backend
  private storeCognitoInformationInSSM(
    userPoolId: string,
    userPoolClientId: string,
    cognitoDomain: string,
    callbackUrl: string,
    identityPoolId: string,
    agencyIdpName?: string
  ) {
    const region = deaConfig.region();
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

    if (agencyIdpName) {
      // Put the name of the IdP in SSM so the hosted UI can automaticaly redirect to the IdP Signin page
      new StringParameter(this, 'agency-idp-name', {
        parameterName: `/dea/${region}/${stage}-agency-idp-name`,
        stringValue: agencyIdpName,
        description: 'stores the agency idp name for redirection during login with hosted ui',
        tier: ParameterTier.STANDARD,
        allowedPattern: '.*',
      });
    }
  }
}
