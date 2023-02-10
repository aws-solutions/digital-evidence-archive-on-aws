/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import minimist from 'minimist';
import CognitoHelper from '../../test-e2e/helpers/cognito-helper';

const args = minimist(process.argv.slice(2));

const deleteUser = async (userName: string) => {
  await cognitoHelper.deleteUser(userName);
};

const verifyRequiredParam = (name: string) => {
  if (!args[name]) {
    console.error(`required parameter '--${name}' is unspecified`);
    process.exit(1);
  }
};

verifyRequiredParam('username');

const cognitoHelper = new CognitoHelper();

void deleteUser(args.username);
