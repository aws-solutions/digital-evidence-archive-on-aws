/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import minimist from 'minimist';
import { auditRedrive } from './audit-redrive';

const args = minimist(process.argv.slice(2));

const verifyRequiredParam = (name: string) => {
  if (args[name] === undefined) {
    console.error(`required parameter '--${name}' is unspecified`);
    process.exit(1);
  }
};

verifyRequiredParam('startTimeMilliseconds');
verifyRequiredParam('endTimeMilliseconds');
const dryRun = args['dryRun'] !== 'false';

void auditRedrive(Number(args.startTimeMilliseconds), Number(args.endTimeMilliseconds), dryRun);
