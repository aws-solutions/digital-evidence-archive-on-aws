/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import pkceChallenge from 'pkce-challenge';
import puppeteer from 'puppeteer';
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
  const browser = await puppeteer.launch();
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
