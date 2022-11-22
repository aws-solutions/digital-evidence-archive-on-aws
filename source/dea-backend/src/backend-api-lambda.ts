/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getBackendApiApp } from '@aws/dea-app';
import serverlessExpress from '@vendia/serverless-express';

exports.handler = serverlessExpress({ app: getBackendApiApp() });
