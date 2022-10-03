# Digital Evidence Archive

Digital Evidence Archive on AWS enables Law Enforcement organizations to ingest evidence data to aid digital data management

## Project Setup

Checkout the Repository

```
git clone ssh://git.amazon.com/pkg/Digital-evidence-archive $WORKSPACE_NAME
```

- Be sure to ingest MAF Workbench core submodule
- Use the following command to checkout solution spark

```
git submodule update --init --recursive --remote
```

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
