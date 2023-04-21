# Digital Evidence Archive

Digital Evidence Archive on AWS enables Law Enforcement organizations to ingest evidence data to aid digital data management

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-96.09%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-85.92%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-93.57%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-96.15%25-brightgreen.svg?style=flat) |


# Getting Started

Deployments are controlled by your `STAGE` environment variable. If unspecified this will default to `chewbacca`.
Any deployments cohabitating on a single AWS account will require an account-unique `STAGE` name.
By default the build process will seek a configuration file ([example](/source/common/config/chewbacca.json)) with the same name as your `STAGE`, however, you can optionally specify `CONFIGNAME` in your environment to specify a filename separate from your `STAGE`, this is useful if you want multiple stages that share the same configuration.
DEA deployment requires a Cognito Domain Prefix to be specified for creation and reference during CDK deployment, for this you must set a value for `DOMAIN_PREFIX` in your environment. If a value is not specified a CfnParameter will be added to the stack, which will produce an error if not specified during deployment along the lines of `Resolution error: ID components may not include unresolved tokens`.
There are several environment values required to run E2E tests successfully, these should be set for you when running the test suite after deploying your stack. If you notice your tests failing due to unset values you can run the [setEnv](/source/common/scripts/setEnv.sh) script to pull these values from your stack (e.g. `source ./common/scripts/setEnv.sh`).

Install Rush 


```sh
npm install -g @microsoft/rush
```

Run Rush Install and build code

```
cd ./source
rush cupdate
rush build
```
Deploy via the dea-main package:
```
cd ./dea-main
rushx cdk bootstrap aws://{aws id}/{region}
rushx cdk deploy
```
---
## https proxy for local UI development
To support secure cookies during local development, you will need to use https with localhost. For this to work you will need a locally trusted Certification Authority. You can do this using mkcert:

```sh
brew install mkcert
mkcert install
```

> Then create a .pem key in /dea-ui/ui

```sh
cd dea-ui/ui
mkcert localhost
```

At this point you can run an https proxy for localhost.

> In dea-ui/ui

```sh
rushx dev:https
```

Now `https://localhost:3001` will proxy requests to `localhost:3000`

The proxy will launch the applicacion in backgound and there is no need to run `rushx dev` as you normally would. use `https://localhost:3001/{stage}/ui` to access the front end

---
## CDK Policy Customization
By default, the policies that CDK boostraps with are too permissive, so we recommend customizing the cdkCFExecutionPolicy. This is done using a policy document, ([cdkCFExecutionPolicy.json](.github/cdkCFExecutionPolicy.json))
First, create the customized policy, via the aws cli:
```
aws iam create-policy \
  --policy-name cdkCFExecutionPolicy \
  --policy-document file://../../.github/cdkCFExecutionPolicy.json
```
Then boostrap your account, specifying the custom policy:
```
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
cdk bootstrap aws://$ACCOUNT_ID/$AWS_REGION \
  --cloudformation-execution-policies "arn:aws:iam::$ACCOUNT_ID:policy/cdkCFExecutionPolicy"
```
At this point your CDK deployments will use the customized policy!
If you need to update the policy, simply modify the JSON file, and create a policy version, setting it as the default 
> :warning: There is a limit to the number of policy versions.
> Prior to creating a new version, you may need to list, and delete an existing version
```
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
aws iam create-policy-version \
  --policy-arn arn:aws:iam::$ACCOUNT_ID:policy/cdkCFExecutionPolicy \
  --policy-document file://../../.github/cdkCFExecutionPolicy.json \
  --set-as-default
```

---
## Test User Generation for API requests
The default APIs are secured with IAM authentication, to support the development process there are some npm scripts available that grant basic test user management. The credentials retrieved from your test users can be used via AWSv4 authentication along with a custom header value `idToken`.
The following tasks are available in the [dea-app](/source/dea-app/) directory, and act upon a deployed cognito instance, identified by ENV values from [setEnv](/source/common/scripts/setEnv.sh).
#### Create Test User
- This will generate a test user in your deployed Cognito instance, and output to your terminal the API credentials for this user.
> example:
`npm run create-cognito-user -- --username=jdoe --firstname=johnny --lastname=doe --usergroup=CaseWorker --password=somepw`
#### Get credential for a Test User
- This will retrieve, and print to the terminal, API credentials for an existing user. 
> example:
`npm run get-user-creds -- --username=jdoe --password=somepw`
#### Delete a Test User
- This will delete an existing test user
> example:
`npm run delete-cognito-user -- --username=jdoe`

---
## Creating a PR from a Commit(s)

OPTIONAL: run commit hooks locally

```
RUN_HOOKS=true git commit
```

OPTIONAL: run CFNNag locally
(NOTE: for now, CFNNag errors will not fail in the GitAction Checkers for the PR, so for now run locally)

```
STAGE=$STAGE rushx cdk synth
rushx nag
```

```
git pull origin develop --rebase
```

```
git push origin somebranchname
```

Go to the branch in GitHub, and Press Submit Pull Request

Assign a reviewer, and ensure Checks Pass

---
### Testing

Tests are split into 3 categories:

- **Unit**: Tests that focus on an isolated component, often via mocking subsystems. Files with unit tests are named with the suffix `.unit.test.ts`
- **Integration**: Tests that exercise the coherence of multiple components, generally no components are mocked in these tests, however these tests do not run against a live environment. Files with integration tests are named with the suffix `.integration.test.ts`
- **E2E**: Tests that exercise the application through all layers starting with UI or API. These tests run against a live environment, and thus will require local AWS credentials with a deployed application (via cdk deploy). Further, the environment variable `DEA_API_URL` needs to be set to the DEA App API Gateway URL, including the stage and trailing slash, e.g. `https://abc123.execute-api.us-east-1.amazonaws.com/dev/`. The environment variables for `IDENTITY_POOL_ID`, `USER_POOL_ID`, and `USER_POOL_CLIENT_ID` also need to be set, and you can find the values from the CFN output. Alternatively, you can set these values in a yaml config and run `IS_LOCAL_DEA_TESTING=true STAGE=$STAGE rushx e2e:only`. Files with E2E tests are named with the suffix `.e2e.test.ts`

There are several test task provided to run tests against the codebase:
The default test tasks will run all test suites (Unit, Integration and E2E). Note `rush` will run against all packages, whereas `rushx` will run against the current directory's package.
```
rush test
rush test:only
```
Additionally there are 4 tasks that will run only specific test suite(s):
```
rush unit:only
rush integration:only
rush e2e:only
rush test:noe2e (ideal for updating coverage without running E2E)
```
> :warning: Java Runtime Environment (JRE) is required for unit tests to run successfully. Please install before running unit tests  

#### IdP End to End Test
In the Auth E2E test suite we include a test that mimics DEA Authentication and Authorization Process with the configured external IDP. This test will be skipped UNLESS you have 
configured your stack with the IdP (affirmed by querying SSM ParamStore for the Idp Name) AND you have stored credentials for a test user in SSM using the following command:

```
cd ./dea-app
rushx idp-test-setup --username <TEST_USER_NAME> --password <TEST_USER_PASSWORD>
```

The user should already be created in the IdP, assigned to the DEA application under test, and given DEARole of CaseWorker.

### One Time Package Installs

- Enable pnpm commands (needed for local CDK bundling)
  `npm install -g pnpm`
- Install Rush, the monorepo management tool
  `npm install -g @microsoft/rush`

## Further setup

Please see the Developer Runbook for further instrunctions
https://w.amazon.com/bin/view/WWPS/MissionAccelerators/DigitalEvidenceArchive/DeveloperRunbook/

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

http://www.apache.org/licenses/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License.
