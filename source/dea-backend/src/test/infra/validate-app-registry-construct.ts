/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Template } from 'aws-cdk-lib/assertions';

export const validateAppRegistryConstruct = (template: Template, solutionVersion: string): void => {
  //the app registry construct
  template.hasResourceProperties('AWS::ServiceCatalogAppRegistry::Application', {
    Description: 'Service Catalog application to track and manage all your resources for the solution',
  });

  template.hasMapping('Solution', {
    Data: {
      ID: 'SO0224',
      SolutionVersion: solutionVersion,
      AppRegistryApplicationName: 'digital-evidence-archive',
      SolutionName: 'Digital Evidence Archive',
      ApplicationType: 'AWS-Solutions',
    },
  });

  template.hasOutput('AppRegistryArn', {
    Description: 'ARN of the application registry',
  });
};
