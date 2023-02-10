/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import 'source-map-support/register';
import { convictConfig } from '../../config';
import { DeaAuthConstruct } from '../../constructs/dea-auth';
import { addSnapshotSerializers } from './dea-snapshot-serializers';

describe('DeaAuth constructs', () => {
  it('synthesizes the way we expect', () => {
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

    addSnapshotSerializers();

    expect(template).toMatchSnapshot();
  });

  it('works without a domain config', () => {
    convictConfig.set('cognito.domain', undefined);

    const app = new cdk.App();
    const stack = new Stack(app, 'test-stack');

    const apiEndpointArns = new Map([
      ['A', 'Aarn'],
      ['B', 'Barn'],
      ['C', 'Carn'],
      ['D', 'Darn'],
    ]);
    new DeaAuthConstruct(stack, 'DeaAuth', { apiEndpointArns });

    // throws due to unassigned parameter
    expect(() => {
      Template.fromStack(stack);
    }).toThrow('ID components may not include unresolved tokens');
  });
});
