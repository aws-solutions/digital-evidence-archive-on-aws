/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import pkceChallenge from 'pkce-challenge';
import puppeteer from 'puppeteer';
import { CognitoSsmParams } from '../../app/services/parameter-service';
import { PARAM_PREFIX } from '../../storage/parameters';
import { testEnv } from './settings';

export interface PkceStrings {
  code_challenge: string;
  code_verifier: string;
}

export const getAuthorizationCode = async (
  cognitoDomainPath: string,
  callbackUrl: string,
  username: string,
  password: string,
  code_challenge: string,
  agencyIdpName?: string
) => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();

  const clientId = testEnv.clientId;

  // Step 2: Sign in to the hosted UI
  let hostedUiUrl = `${cognitoDomainPath}/login?response_type=code&client_id=${clientId}&redirect_uri=${callbackUrl}&code_challenge=${code_challenge}&code_challenge_method=S256`;
  if (agencyIdpName) {
    hostedUiUrl = `${cognitoDomainPath}/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${callbackUrl}&code_challenge=${code_challenge}&code_challenge_method=S256&identity_provider=${agencyIdpName}`;
  }
  await page.goto(hostedUiUrl);

  // Get the login fields
  await page.content();
  const logonField = await page.waitForSelector("input[type='text']");
  const pwField = await page.waitForSelector("input[type='password']");
  const submitField = await page.waitForSelector("input[type='submit']");

  if (!logonField || !pwField || !submitField) {
    throw new Error('Was unable to find required page elements to log on.');
  }

  // Fill in the fields and submit
  await logonField.type(username);
  await pwField.type(password);
  await submitField.click();

  await page.waitForNavigation({
    waitUntil: 'load',
  });

  const redirectUri = page.url();
  const authorizationCode = redirectUri.split('code=')[1];

  if (!authorizationCode) {
    throw new Error('Could not retrieve the authorization code');
  }

  await browser.close();
  return authorizationCode;
};

export const getPkceStrings = (): PkceStrings => {
  const challenge = pkceChallenge(128);

  // challenge.code_challenge is used for hosted UI URL
  // challenge.code_verifier is needed for Token retrival

  return {
    code_challenge: challenge.code_challenge,
    code_verifier: challenge.code_verifier,
  };
};

let cachedCognitoParams: CognitoSsmParams;

export const getCognitoSsmParams = async (): Promise<CognitoSsmParams> => {
  if (cachedCognitoParams) {
    return cachedCognitoParams;
  }

  const ssmClient = new SSMClient({ region: testEnv.awsRegion });
  const stage = testEnv.stage;

  const cognitoDomainPath = `${PARAM_PREFIX}${stage}-userpool-cognito-domain-param`;
  const clientIdPath = `${PARAM_PREFIX}${stage}-userpool-client-id-param`;
  const callbackUrlPath = `${PARAM_PREFIX}${stage}-client-callback-url-param`;
  const identityPoolIdPath = `${PARAM_PREFIX}${stage}-identity-pool-id-param`;
  const userPoolIdPath = `${PARAM_PREFIX}${stage}-userpool-id-param`;
  const agencyIdpNamePath = `${PARAM_PREFIX}${stage}-agency-idp-name`;

  const response = await ssmClient.send(
    new GetParametersCommand({
      Names: [
        cognitoDomainPath,
        clientIdPath,
        callbackUrlPath,
        identityPoolIdPath,
        userPoolIdPath,
        agencyIdpNamePath,
      ],
    })
  );

  if (!response.Parameters) {
    throw new Error(
      `No parameters found for: ${cognitoDomainPath}, ${clientIdPath}, ${callbackUrlPath}, ${identityPoolIdPath}, ${userPoolIdPath}, ${agencyIdpNamePath}`
    );
  }

  let cognitoDomainUrl;
  let clientId;
  let callbackUrl;
  let identityPoolId;
  let userPoolId;
  let agencyIdpName;

  response.Parameters.forEach((param) => {
    switch (param.Name) {
      case cognitoDomainPath:
        cognitoDomainUrl = param.Value;
        if (cognitoDomainUrl && process.env.AWS_REGION === 'us-gov-west-1') {
          // support our one-click in us-gov-west-1, which only has fips endpoints
          cognitoDomainUrl = cognitoDomainUrl.replace('.auth.', '.auth-fips.');
        }
        break;
      case clientIdPath:
        clientId = param.Value;
        break;
      case callbackUrlPath:
        callbackUrl = param.Value;
        break;
      case identityPoolIdPath:
        identityPoolId = param.Value;
        break;
      case userPoolIdPath:
        userPoolId = param.Value;
        break;
      case agencyIdpNamePath:
        agencyIdpName = param.Value;
        break;
    }
  });

  if (cognitoDomainUrl && clientId && callbackUrl && identityPoolId && userPoolId) {
    cachedCognitoParams = {
      cognitoDomainUrl,
      clientId,
      callbackUrl,
      identityPoolId,
      userPoolId,
      agencyIdpName,
    };
    return cachedCognitoParams;
  } else {
    throw new Error(
      `Unable to grab the parameters in SSM needed for token verification: ${cognitoDomainUrl}, ${clientId}, ${callbackUrl}, ${identityPoolId}`
    );
  }
};
