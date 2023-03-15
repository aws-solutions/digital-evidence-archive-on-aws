/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import puppeteer from 'puppeteer';
import { testEnv } from './settings';

export const getAuthorizationCode = async (
  cognitoDomainPath: string,
  callbackUrl: string,
  username: string,
  password: string
) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const clientId = testEnv.clientId;

  // Step 2: Sign in to the hosted UI
  const hostedUiUrl = `${cognitoDomainPath}/login?response_type=code&client_id=${clientId}&redirect_uri=${callbackUrl}`;
  await page.goto(hostedUiUrl);
  await page.type('input[id="signInFormUsername"]', username);
  await page.type('input[id="signInFormPassword"]', password);

  await page.click('input[name="signInSubmitButton"]');

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
