/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Application } from '@aws-cdk/aws-servicecatalogappregistry-alpha';
import { Aws, CfnMapping, Fn, Stack, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DeaAppRegisterProps {
  solutionId: string;
  solutionName: string;
  solutionVersion: string;
  appRegistryApplicationName: string;
  applicationType: string;
}

export class DeaAppRegisterConstruct extends Construct {
  readonly registryApplication: Application;
  private readonly appRegMap: CfnMapping;

  constructor(stack: Stack, id: string, props: DeaAppRegisterProps) {
    super(stack, id);
    this.appRegMap = this.createMapForAppRegistry(stack, props);
    this.registryApplication = this.createAppRegistry(stack);
    this.createAttributeGroup();
    this.applyTagsToApplication();
  }

  private createAppRegistry(stack: Stack): Application {
    const application = new Application(stack, 'AppRegistry', {
      applicationName: Fn.join('-', [
        this.appRegMap.findInMap('Data', 'AppRegistryApplicationName'),
        Aws.REGION,
        Aws.ACCOUNT_ID,
        Aws.STACK_NAME, // AWS CloudFormation has an overall limit of 128 characters for the name of a stack.
      ]),
      description: 'Service Catalog application to track and manage all your resources for the solution',
    });
    application.associateApplicationWithStack(stack);

    return application;
  }

  private createAttributeGroup() {
    this.registryApplication.addAttributeGroup('DefaultApplicationAttributes', {
      attributeGroupName: Fn.join('-', [Aws.REGION, Aws.STACK_NAME]),
      description: 'Attribute group for solution information',
      attributes: {
        applicationType: this.appRegMap.findInMap('Data', 'ApplicationType'),
        version: this.appRegMap.findInMap('Data', 'SolutionVersion'),
        solutionID: this.appRegMap.findInMap('Data', 'ID'),
        solutionName: this.appRegMap.findInMap('Data', 'SolutionName'),
      },
    });
  }

  private createMapForAppRegistry(stack: Stack, props: DeaAppRegisterProps) {
    const map = new CfnMapping(stack, 'Solution');
    map.setValue('Data', 'ID', props.solutionId);
    map.setValue('Data', 'SolutionVersion', props.solutionVersion);
    map.setValue('Data', 'AppRegistryApplicationName', props.appRegistryApplicationName);
    map.setValue('Data', 'SolutionName', props.solutionName);
    map.setValue('Data', 'ApplicationType', props.applicationType);

    return map;
  }

  private applyTagsToApplication() {
    Tags.of(this.registryApplication).add('Solutions:SolutionID', this.appRegMap.findInMap('Data', 'ID'));
    Tags.of(this.registryApplication).add(
      'Solutions:SolutionName',
      this.appRegMap.findInMap('Data', 'SolutionName')
    );
    Tags.of(this.registryApplication).add(
      'Solutions:SolutionVersion',
      this.appRegMap.findInMap('Data', 'SolutionVersion')
    );
    Tags.of(this.registryApplication).add(
      'Solutions:ApplicationType',
      this.appRegMap.findInMap('Data', 'ApplicationType')
    );
  }
}
