/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import minimist from 'minimist';
import CognitoHelper from '../../test-e2e/helpers/cognito-helper';

const args = minimist(process.argv.slice(2));

const outputCreds = async (userName: string) => {
  const [creds, idToken] = await cognitoHelper.getCredentialsForUser(userName);
  console.log(`----------- IAM Credentials for ${userName} -----------`);
  console.log({
    ...creds,
    idToken,
  });
  console.log(`----------- IAM Credentials end -----------`);
};

const verifyRequiredParam = (name: string) => {
  if (!args[name]) {
    console.error(`required parameter '--${name}' is unspecified`);
    process.exit(1);
  }
};

verifyRequiredParam('username');
verifyRequiredParam('password');

const cognitoHelper = new CognitoHelper(args.password);

void outputCreds(args.username);
