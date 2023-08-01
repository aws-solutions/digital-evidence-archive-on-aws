/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  addSnapshotSerializers,
  validateAppRegistryConstruct,
  validateBackendConstruct,
} from '@aws/dea-backend';
import { convictConfig } from '@aws/dea-backend/lib/config';
import { validateDeaUiConstruct } from '@aws/dea-ui-infrastructure';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import 'source-map-support/register';
import { DeaMainStack, SOLUTION_VERSION } from '../dea-main-stack';

describe('DeaMainStack', () => {
  it('synthesizes the way we expect', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain: any = 'deatestenv';
    convictConfig.set('cognito.domain', domain);

    const app = new cdk.App();

    // Create the DeaMainStack
    const props = {
      env: {
        region: 'us-east-1',
      },
      crossRegionReferences: true,
    };
    const deaMainStack = new DeaMainStack(app, 'DeaMainStack', props);

    const template = Template.fromStack(deaMainStack);

    validateAppRegistryConstruct(template, SOLUTION_VERSION);

    validateBackendConstruct(template);

    // Assert it creates the api with the correct properties...
    validateDeaUiConstruct(template);

    addSnapshotSerializers();

    expect(template).toMatchSnapshot();
  });

  it('restricts resource policies in production', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const domain: any = 'deatestenv';
    convictConfig.set('cognito.domain', domain);
    convictConfig.set('testStack', false);

    const app = new cdk.App();

    // Create the DeaMainStack
    const props = {
      env: {
        region: 'us-east-1',
      },
      crossRegionReferences: true,
    };
    const deaMainStack = new DeaMainStack(app, 'DeaMainStack', props);

    const template = Template.fromStack(deaMainStack);

    const cwlToS3InfraPolicyCount = 2;
    template.resourceCountIs('AWS::S3::BucketPolicy', 4 + cwlToS3InfraPolicyCount);
  });

  it("disables the FIPS-compliant endpoints. Non US regions don't have FIPS endpoints.", () => {
    convictConfig.set('fipsEndpointsEnabled', false);
    convictConfig.set('testStack', false);

    const app = new cdk.App();

    // Create the DeaMainStack
    const props = {
      env: {
        region: 'eu-central-1',
      },
      crossRegionReferences: true,
    };
    const deaMainStack = new DeaMainStack(app, 'DeaMainStack', props);

    const template = Template.fromStack(deaMainStack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          AWS_USE_FIPS_ENDPOINT: 'false',
        }),
      },
    });
  });

  it('disables multi region trails', () => {
    convictConfig.set('isMultiRegionTrail', false);
    convictConfig.set('testStack', false);

    const app = new cdk.App();

    // Create the DeaMainStack
    const props = {
      env: {
        region: 'eu-central-1',
      },
      crossRegionReferences: true,
    };
    const deaMainStack = new DeaMainStack(app, 'DeaMainStack', props);

    const template = Template.fromStack(deaMainStack);

    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      IsMultiRegionTrail: false,
    });
  });
});
