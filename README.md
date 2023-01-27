# Digital Evidence Archive

Digital Evidence Archive on AWS enables Law Enforcement organizations to ingest evidence data to aid digital data management

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-97.3%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-85.71%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-91.74%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-97.53%25-brightgreen.svg?style=flat) |


## Project Setup

1. Sign in to GitHub

2. Fork the repository https://github.com/aws-solutions/digital-investigations-on-aws. Underneath the page header, on the upper right, the fork button is second from the right. Choose your account as the owner and uncheck the copy only main branch.

3. Clone the forked repo, inputting your username, then your ACCESS token from step 1 as the password

```
WORKSPACE_NAME=<e.g. DEADev>
git clone git@github.com:aws-solutions/digital-investigations-on-aws.git $WORKSPACE_NAME
cd ./$WORKSPACE_NAME
```

4. Create a Branch (Needed for PRs)

```
git checkout -b $BRANCH_NAME
```

5. Run Rush Install

```
cd ./source
rush cupdate
```

6. Setup Git Defender

```
git defender --setup
```

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
Additionally there are 3 tasks that will run only the specified test suite:
```
rush unit:only
rush integration:only
rush e2e:only
```
> :warning: Java Runtime Environment (JRE) is required for unit tests to run successfully. Please install before running unit tests  

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
