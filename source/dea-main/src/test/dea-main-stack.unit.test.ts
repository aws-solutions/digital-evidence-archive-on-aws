/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { addSnapshotSerializers, validateBackendConstruct } from '@aws/dea-backend';
import { validateDeaUiConstruct } from '@aws/dea-ui-infrastructure';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import 'source-map-support/register';
import { DeaMainStack } from '../dea-main-stack';

describe('DeaMainStack', () => {
  it('synthesizes the way we expect', () => {
    const app = new cdk.App();

    // Create the DeaMainStack
    const deaMainStack = new DeaMainStack(app, 'DeaMainStack', {});

    const template = Template.fromStack(deaMainStack);

    validateBackendConstruct(template);

    // Assert it creates the api with the correct properties...
    validateDeaUiConstruct(template);

    addSnapshotSerializers();

    expect(template).toMatchSnapshot();
  });
});
