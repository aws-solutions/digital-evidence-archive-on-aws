#!/usr/bin/env node

/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import 'source-map-support/register';
import { deaConfig } from '@aws/dea-backend';
import * as cdk from 'aws-cdk-lib';
import { DeaMainStack } from './dea-main-stack';

const app: cdk.App = new cdk.App();
const stage = deaConfig.stage();
const region = deaConfig.region();

let props = {};
if (!deaConfig.isOneClick) {
  props = {
    env: {
      region,
    },
    crossRegionReferences: true,
  };
}

new DeaMainStack(app, `${stage}-DeaMainStack`, props);
