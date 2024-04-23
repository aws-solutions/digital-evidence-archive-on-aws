/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import convict from 'convict';
import inquirer, { Answers, ListQuestion, Question } from 'inquirer';
import {
  ACM_REGEX,
  ADMIN_ROLE_ARN_REGEX,
  DOMAIN_REGEX,
  HOSTED_ZONE_ID_REGEX,
  HOSTED_ZONE_NAME_REGEX,
  REGIONS,
  SubnetMaskCIDRFormat,
  cognitoDomainFormat,
  convictSchema,
  deaStageFormat,
  getSourcePath,
  loadConfig,
  uploadTimeoutFormat,
} from '../config';
import { ApiGatewayMethod } from '../resources/api-gateway-route-config';
import { deaApiRouteConfig } from '../resources/dea-route-config';

const convictConfig = convict(convictSchema);

export function configFileExists(configName: string) {
  const sourceDir = getSourcePath();
  const path = `${sourceDir}/common/config/${configName}.json`;

  return fs.existsSync(path);
}

export async function generateConfig(configName: string) {
  // Set the convictConfig
  const configObject = await generateConfigJson(configName);
  const jsonString = JSON.stringify(configObject, null, 2);

  // Write config file
  const sourceDir = getSourcePath();
  const path = `${sourceDir}/common/config/${configName}.json`;
  fs.writeFileSync(path, jsonString);

  try {
    loadConfig(configName);
    console.log(`Successfully wrote config file: ${configName}.json`);
  } catch (e) {
    console.error(`Error writing config file: ${configName}.json`);
    console.error(e);
    process.exit(1);
  }
}

type Endpoint = {
  readonly method: ApiGatewayMethod;
  readonly path: string;
};

type DeaRole = {
  readonly name: string;
  readonly description?: string;
  readonly endpoints: Endpoint[];
};
enum RoleCreationOption {
  DEV = 'Use Dev Sample Roles',
  PROD = 'Use Prod Sample Roles',
  CUSTOM = 'Define your own roles',
}

async function handleDeaRoleUseCase(roleCreationOption: RoleCreationOption): Promise<DeaRole[]> {
  const roles: DeaRole[] = [];

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  if (roleCreationOption! === RoleCreationOption.CUSTOM) {
    let done = false;
    const endpointChoicesMap = generateEndpointsChoicesMap();
    while (!done) {
      await inquirer
        .prompt([
          {
            type: 'input',
            name: 'name',
            message: 'What is the name of the role? E.g. Investigator',
            validate: (input: string) => {
              if (input.length === 0) {
                return 'Name cannot be empty';
              }
              if (roles.find((role) => role.name === input)) {
                return 'Role name already exists';
              }

              return true;
            },
          },
          {
            type: 'input',
            name: 'description',
            message: 'What is the description of the role? E.g. Users who can view and download cases',
          },
          {
            type: 'checkbox',
            name: 'endpoints',
            message:
              'What endpoints does the role have access to? (Privileged Endpoints are denoted by *EndpointName*)',
            choices: Array.from(endpointChoicesMap.keys()),
            filter: (input: string[]) => {
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              return input.map((choice) => endpointChoicesMap.get(choice)!);
            },
          },
          {
            type: 'confirm',
            name: 'doContinue',
            message: 'Do you want to add another?',
            default: false,
          },
        ])
        .then((answers: Answers) => {
          if (!answers.doContinue) {
            done = true;
          }

          roles.push({
            name: answers.name,
            description: answers.description,
            endpoints: answers.endpoints,
          });
        });
    }
  } else {
    const sourceDir = getSourcePath();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const stage = roleCreationOption! === RoleCreationOption.PROD ? 'prodexample' : 'devsample';
    const config = convictConfig.loadFile(`${sourceDir}/common/config/${stage}.json`);
    roles.push(...config.get('deaRoleTypes'));
  }

  return roles;
}

async function generateConfigJson(configName: string): Promise<object> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configJson: Record<string, any> = {};
  const questions = generateQuestions(configName);
  await inquirer.prompt(questions).then((answers: Answers) => {
    const keys = Object.keys(answers);
    const ignoreKeys = ['doCustomDomainSetup', 'customDomainType'];
    keys.filter((key) => !ignoreKeys.includes(key)).forEach((key) => (configJson[key] = answers[key]));
  });

  let roleCreationOption: RoleCreationOption;
  await inquirer
    .prompt([
      {
        type: 'list',
        name: 'createRoleChoice',
        message: 'How would you like to define your access roles for DEA? ',
        choices: Object.values(RoleCreationOption),
      },
    ])
    .then((answers: Answers) => {
      roleCreationOption = answers.createRoleChoice;
    });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const roles = await handleDeaRoleUseCase(roleCreationOption!);
  configJson['deaRoleTypes'] = roles;

  return configJson;
}

// Visible for Testing
export function generateQuestions(configName: string): (Question | ListQuestion)[] {
  const questions: (Question | ListQuestion)[] = [];
  for (const field of Object.keys(convictSchema)) {
    switch (field) {
      case 'stage':
        questions.push({
          type: 'input',
          name: 'stage',
          message:
            'Specify the stage name for the DEA deployment. Will be used as the stack name in CloudFormation',
          default: configName,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          validate: generateValidateFunction((input) => deaStageFormat.validate!(input, convictConfig)),
        });
        break;
      case 'configname':
        // Skip, we don't actually specify this
        break;
      case 'region':
        questions.push({
          type: 'list',
          name: 'region',
          choices: Array.from(REGIONS.keys()),
          message: 'Select which AWS region to deploy DEA in',
          pageSize: 7,
          filter: (input) => REGIONS.get(input),
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          validate: (input) => convictSchema.region.format.includes(input),
        });
        break;
      case 'cognito':
        questions.push({
          type: 'input',
          name: 'cognito.domain',
          message:
            'Specify an unique domain prefix which will be used for the hosted Cognito login. NOTE: this is separate from you custom domain. (e.g. myagencydea)',
          default: process.env['DOMAIN_PREFIX'],
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          validate: generateValidateFunction((input) => cognitoDomainFormat.validate!(input, convictConfig)),
        });
        break;
      case 'customDomain':
        // Since this is an optional configuration, ask users if they would
        // like to set up a custom domain,
        questions.push({
          type: 'confirm',
          name: 'doCustomDomainSetup',
          default: false,
          message: 'Do you have a custom domain you want to set up for this solution?',
        });

        // If they did want to, ask what type (Route53 or external domain)
        questions.push({
          type: 'list',
          name: 'customDomainType',
          choices: ['Route53', 'Other'],
          message: 'What type of custom domain will you be using?',
          when: (answers) => answers.doCustomDomainSetup,
        });

        // Handle the relevant fields
        questions.push({
          type: 'input',
          name: 'customDomain.domainName',
          message: 'What is the domain name? (e.g. example.com)',
          when: (answers) => answers.doCustomDomainSetup,
          validate: genValidateFunctionRegex(DOMAIN_REGEX),
        });
        questions.push({
          type: 'input',
          name: 'customDomain.certificateArn',
          message:
            'What is the ACM certificate arn? (should look like arn:aws:acm:us-east-1:ACCTNUM:certificate/CERT_NUM)',
          when: (answers) => answers.doCustomDomainSetup,
          validate: genValidateFunctionRegex(ACM_REGEX),
        });

        // (Route53 domains have 2 extra fields)
        questions.push({
          type: 'input',
          name: 'customDomain.hostedZoneId',
          message: 'What is the Route53 hosted zone id? (e.g. Z1ABCDEFGH)',
          when: (answers) => answers.doCustomDomainSetup && answers.customDomainType === 'Route53',
          validate: genValidateFunctionRegex(HOSTED_ZONE_ID_REGEX),
        });
        questions.push({
          type: 'input',
          name: 'customDomain.hostedZoneName',
          message: 'What is the Route53 hosted zone name? (e.g. example.com)',
          when: (answers) => answers.doCustomDomainSetup && answers.customDomainType === 'Route53',
          validate: genValidateFunctionRegex(HOSTED_ZONE_NAME_REGEX),
        });
        break;
      case 'vpcEndpoint':
        // TODO: Skip this until we handle custom domain with API Gateway VPC endpoint
        break;
      case 'idpInfo':
        // Skip this since you have to deploy DEA, then configure your IdP for DEA, then
        // deploy DEA again. This case will be handled on the upgrade script
        break;
      case 'testStack':
        questions.push({
          type: 'confirm',
          name: 'testStack',
          default: convictSchema.testStack.default,
          message: 'Is this a test stack (non production deployment)?',
        });
        break;
      case 'isOneClick':
        // We don't let customers use OneClick for production deployments
        // so dont set this, the default is false
        break;
      case 'sourceIpValidation':
        questions.push({
          type: 'confirm',
          name: 'sourceIpValidation',
          default: convictSchema.sourceIpValidation.default,
          message: 'Should pre-signed url access be ip-restricted? (if using a VPN, should be false)',
        });
        break;
      case 'sourceIpSubnetMaskCIDR':
        questions.push({
          type: 'input',
          name: 'sourceIpSubnetMaskCIDR',
          message: 'What is the subnet mask for source ip validation (e.g. 32 for /32)?',
          default: convictSchema.sourceIpSubnetMaskCIDR.default,
          when: (answers) => answers.sourceIpValidation,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          validate: generateValidateFunction((input) => SubnetMaskCIDRFormat.validate!(input, convictConfig)),
        });
        break;
      case 'deaRoleTypes':
        // Skip: We handle this as a special case.
        // We ask if they would like to use defaults, and if not
        // loop through creating roles
        break;
      case 'deaAllowedOrigins':
        questions.push({
          type: 'input',
          name: 'deaAllowedOrigins',
          message: 'What are the allowed origins for DEA (comma separated)?',
          default: convictSchema.deaAllowedOrigins.default,
        });
        break;
      case 'deletionAllowed':
        // Skip this, just use default. Will have a more sophisticated system later for deletion
        break;
      case 'fipsEndpointsEnabled':
        questions.push({
          type: 'confirm',
          name: 'fipsEndpointsEnabled',
          message:
            'Should the FIPS-compliant endpoints be used? (Should be yes for us and gov regions, no for other regions)',
          default: convictSchema.fipsEndpointsEnabled.default,
          when: (answers) => answers.region.startsWith('us-'),
        });
        break;
      case 'isMultiRegionTrail':
        questions.push({
          type: 'confirm',
          name: 'isMultiRegionTrail',
          message:
            'Should CloudTrail deliver log files from multiple regions to a single S3 bucket for a single account? ',
          default: convictSchema.isMultiRegionTrail.default,
        });
        break;
      case 'uploadFilesTimeoutMinutes':
        questions.push({
          type: 'number',
          name: 'uploadFilesTimeoutMinutes',
          message: 'What should the timeout (minutes) be for file upload from the UI? ',
          default: convictSchema.uploadFilesTimeoutMinutes.default,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          validate: generateValidateFunction((input) => uploadTimeoutFormat.validate!(input, convictConfig)),
        });
        break;
      case 'includeDynamoDataPlaneEventsInTrail':
        questions.push({
          type: 'confirm',
          name: 'includeDynamoDataPlaneEventsInTrail',
          message: 'Should the audit CloudTrail include DynamoDB Data-plane events? ',
          default: convictSchema.includeDynamoDataPlaneEventsInTrail.default,
        });
        break;
      case 'auditDownloadTimeoutMinutes':
        questions.push({
          type: 'number',
          name: 'auditDownloadTimeoutMinutes',
          message: 'What should the timeout (minutes) be for audit CSV download? ',
          default: convictSchema.auditDownloadTimeoutMinutes.default,
        });
        break;
      case 'dataSyncLocationBuckets':
        // TODO: Skip until we determine whether we can use AWSDataSyncReadOnlyAccess instead
        break;
      case 'dataSyncSourcePermissions':
        // TODO: Skip until we determine whether we can use AWSDataSyncReadOnlyAccess instead
        break;
      case 'adminRoleArn':
        questions.push({
          type: 'input',
          name: 'adminRoleArn',
          message:
            '(Mass Data Ingestion) Optional ARN to grant KMS and Bucket permissions, useful for pipeline testing',
          default: process.env[convictSchema.adminRoleArn.env],
          validate: genValidateFunctionRegex(ADMIN_ROLE_ARN_REGEX),
        });
        break;
      default:
        throw new Error(`script cannot handle field '${field}', update the script.`);
    }
  }

  return questions;
}

function generateValidateFunction(valFunc: (input: string) => void) {
  return (input: string) => {
    try {
      valFunc(input);
      return true;
    } catch (e) {
      return e;
    }
  };
}

function genValidateFunctionRegex(regex: RegExp) {
  return (input: string) => {
    if (regex.test(input)) {
      return true;
    } else {
      return `Invalid input: must match regex: ${regex}`;
    }
  };
}

function generateEndpointsChoicesMap(): Map<string, Endpoint> {
  const endpointsMap = new Map<string, Endpoint>();
  for (const route of deaApiRouteConfig.routes) {
    const endpointDisplayName = route.isPrivileged ? `*${route.eventName}*` : route.eventName;
    endpointsMap.set(endpointDisplayName, { path: route.path, method: route.httpMethod });
  }
  return endpointsMap;
}
