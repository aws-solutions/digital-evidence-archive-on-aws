/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { deaConfig, validateBackendConstruct } from '@aws/dea-backend';
import { validateDeaUiConstruct } from '@aws/dea-ui-infrastructure';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import 'source-map-support/register';
import { DeaMainStack } from '../dea-main-stack';

describe('DeaMainStack', () => {
  beforeAll(() => {
    process.env.STAGE = 'chewbacca';
  });

  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    const app = new cdk.App();

    // Create the DeaMainStack
    const deaMainStack = new DeaMainStack(app, 'DeaMainStack', {});

    // TODO
    // Prepare the stack for assertions.
    const template = Template.fromStack(deaMainStack);

    validateBackendConstruct(template);

    // Assert it creates the api with the correct properties...
    validateDeaUiConstruct(template);

    expect.addSnapshotSerializer({
      test: (val) => typeof val === 'string' && val.includes('zip'),
      print: (val) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newVal = (val as string).replace(/([A-Fa-f0-9]{64})/, '[HASH REMOVED]');
        return `"${newVal}"`;
      },
    });

    expect.addSnapshotSerializer({
      test: (val) => typeof val === 'string' && val.includes(deaConfig.stage()),
      print: (val) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newVal1 = (val as string).replace(deaConfig.stage(), '[STAGE-REMOVED]');
        const newVal = newVal1.replace(/([A-Fa-f0-9]{8})/, '[HASH REMOVED]');
        return `"${newVal}"`;
      },
    });

    expect(template).toMatchSnapshot();
  });
});
