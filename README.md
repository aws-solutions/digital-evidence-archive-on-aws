# Digital Evidence Archive

Digital Evidence Archive on AWS enables Law Enforcement organizations to ingest evidence data to aid digital data management

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

To run unit testing after successfully building DEA

```
cd ./source
rush test
```

Java Runtime Environment (JRE) is required for unit tests to run successfully. Please install before running unit tests

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
