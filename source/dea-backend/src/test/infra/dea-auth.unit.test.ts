/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import 'source-map-support/register';
import { DeaAuthConstruct } from '../../constructs/dea-auth';

describe('DeaBackend constructs', () => {
  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    process.env.STAGE = 'test';
    const app = new cdk.App();
    const stack = new Stack(app, 'test-stack');

    const apiEndpointArns = new Map([
      ['A', 'Aarn'],
      ['B', 'Barn'],
      ['C', 'Carn'],
      ['D', 'Darn'],
    ]);
    new DeaAuthConstruct(stack, 'DeaAuth', { apiEndpointArns });

    // Prepare the stack for assertions.
    const template = Template.fromStack(stack);

    expect.addSnapshotSerializer({
      test: (val) => typeof val === 'string' && val.includes('zip'),
      print: (val) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newVal = (val as string).replace(/([A-Fa-f0-9]{64})/, '[HASH REMOVED]');
        return `"${newVal}"`;
      },
    });

    expect(template).toMatchSnapshot();
  });

  it('works with a domain config', () => {
    process.env.STAGE = 'demo';

    const app = new cdk.App();
    const stack = new Stack(app, 'test-stack');

    const apiEndpointArns = new Map([
      ['A', 'Aarn'],
      ['B', 'Barn'],
      ['C', 'Carn'],
      ['D', 'Darn'],
    ]);
    new DeaAuthConstruct(stack, 'DeaAuth', { apiEndpointArns });

    // Prepare the stack for assertions.
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Cognito::IdentityPool', {
      AllowUnauthenticatedIdentities: false,
    });
  });
});
