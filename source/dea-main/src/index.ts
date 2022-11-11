#!/usr/bin/env node

/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-new */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DeaMainStack } from './dea-main-stack';

const app: cdk.App = new cdk.App();
new DeaMainStack(app, 'DeaMainStack', {});
