/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import minimist from 'minimist';
import { configFileExists, generateConfig } from './manage-config';

const args = minimist(process.argv.slice(2));

const verifyRequiredParam = (name: string) => {
  if (args[name] === undefined) {
    console.error(`required parameter '--${name}' is unspecified`);
    process.exit(1);
  }
};

verifyRequiredParam('configname');

if (args.configname.length == 0 || typeof args.configname !== 'string') {
  console.error(`must specify a config file name`);
  process.exit(1);
}

// Assert that the config file does not already exist
if (configFileExists(args.configname)) {
  console.error(
    `config with name '${args.configname}' already exists, use update-config-command to update it.`
  );
  process.exit(1);
}

void generateConfig(args.configname);
