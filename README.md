# Digital Evidence Archive

Digital Evidence Archive on AWS enables Law Enforcement organizations to ingest evidence data to aid digital data management

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-95.15%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-80.93%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-93.31%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-95.12%25-brightgreen.svg?style=flat) |


# Getting Started

## Production Deployment
Follow these steps to deploy your production environment. If developing/testing, follow the Simple Deployment Section.

You can deploy using your local computer via the terminal (for Mac/Linux users) or Command Prompt for Windows Users. The commands in the following steps may use different commands depending on which OS your computer is running, so make sure to follow the directions carefully.

### Step 0: Setup a Custom Domain (Recommended)
We recommend using a custom domain, otherwise the URL for the solution will not be human readable. You will need to register a domain using AWS Route53 or other provider, and import a certificate for the domain using AWS Certificate Manager.

1. Register a Domain with Route53 by following https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html#register_new_console
2. Wait for confirmation email
3. Keep Note of the domain name: e.g. digitalevidencearchive.com
4. Route53 automatically creates a hosted zone for your domain. Go to Route 53, click HostedZones on the left tab. Go to the hosted zone that matches your domain name, and copy and paste the Hosted Zone ID somewhere safe
5. Next go to AWS Certificate Manager to request a certificate for your domain: (MAKE SURE TO DO IT IN THE REGION YOU WANT TO DEPLOY) https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html
6. Navigate to the certificate table. The request should be pending. Click on the Certificate ID link, scroll to the Domains section, and on the upper right hand side of that section, click Create Records in Route53. Wait about 10 minutes
7. Once the Certificate is issued, click the Certificate ID link and copy the ARN in the first section. Save this somewhere safe.

### Pre-requisites:

**NOTE** If you are using Windows to deploy, make sure that for each of your installation steps the download path DOES NOT contain spaces. Many of the default paths go to "C:\Program Files\", but certain commands cannot run when the path has a space in it

You will need npm and node installed on your machine:

*For Windows*
Follow the instructions [here](https://learn.microsoft.com/en-us/windows/dev-environment/javascript/nodejs-on-windows) and stop before the Install Visual Studio Code section.
NOTE: During the nvm install, when asked where to place npm, DO NOT place in "C:/Program Files", instead you can put it in "C:\Users\Public\nodejs". 
Additionally we recommend installing the LTS node version instead of the latest.

*For Mac/Linux*
```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
source ~/.bashrc
nvm install node
```

Next you need to install rush to be able to run commands in the repository, cdk for deployment, and a specific version of pnpm (Note pnpm needs to match the version pnpmVersion in rush.json). 
```sh
npm install -g @microsoft/rush
npm install -g pnpm@7.16.0
npm install -g aws-cdk
```

Ensure you have AWS Command Line Interface (AWS CLI) installed, and have your aws credentials set. You can see [here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) for more information about installing AWS CLI.
NOTE: Make sure you change the download location to ensure the path DOES NOT have any spaces.

You'll need to pull the repository to your local machine, therefore you also need git installed. If you do not already have it on your machine you can follow the instructions for your OS [here](https://github.com/git-guides/install-git).

For Windows you will need to install Cygwin so certains scripts can run during the build process. See [here](https://www.cygwin.com/) for installation details. 

If you are using Windows, you may need to restart your command prompt to see the installation changes take place.

### Step 1: Clone the repository
Use the command line to run the following commands:

```sh
git clone https://github.com/aws-solutions/digital-evidence-archive-on-aws
cd ./digital-evidence-archive-on-aws/source/
rush cupdate
rush build
```

### Step 2: Customize your configuration

Next you'll need to copy and rename the default configuration file, and open the copy in a text editor.

**Windows**
```sh
cd ./common/config
copy prodexample.json prod.json
cd ../..
notepad ./common/config/prod.json
```

**Linux**
```sh
cp ./common/config/prodexample.json ./common/config/prod.json
nano ./common/config/prod.json
```

Inside the configuration file, change the following fields
1. Specify your region by including a line in the following format ```"region": "us-east-2"```
2. Specify an unique domain prefix for your hosted Cognito login. NOTE: this is separate from your custom domain. It should look like the following:

```
“cognito”: {
  “domain”: “exampleexampleexample”
},
```
3. If you completed step 0, then import the domainName, hostedZoneId, hostedZoneName, and ACM Certificate ARN like so:
```
"customDomain": {
  "domainName": "example.com",
  "certificateArn": "arn:aws:acm:us-east-1:ACCTNUM:certificate/CERT_NUM",
  "hostedZoneId": "NJKVNFJKNVJF345903",
  "hostedZoneName": "example.com"
},
```
4. Define your User Role Types.
You can see examples of role types already in the file. Feel free to modify these endpoints or create new roles as necessary for your use case.
For each role, specify the name, description, and an array of endpoints defined by path and endpoint method. You can refer to API Reference section of the Implementation Guide for a list of available endpoints. Alternatively, you can view the file called dea-route-config.ts under the dea-backend folder for the most up to date list of API endpoints.  

> :warning: Note about elevated endpoints: The following API endpoints, which can be configured on Roles within deaRoleTypes configuration, are considered elevated. These endpoints grant applicable users access to resources without any case-owner granted membership and are intended for "admin-type" roles.


> - Fetch a list of all cases within the system.  
{
  "path": "/cases/all-cases",
  "method": "GET"
}

> - Fetch information on a case, there is no membership requirement on the caller.  
{
  "path": "/cases/{caseId}/scopedInformation",
  "method": "GET"
}

> - Assign a case owner, can be called on any case in the system.  
{
  "path": "/cases/{caseId}/owner",
  "method": "POST"
}

> - Generate an audit showing all actions taken by a specified user.  
{
  "path": "/users/{userId}/audit",
  "method": "POST"
}

> - Retrieve the results of a generated user audit.  
{
  "path": "/users/{userId}/audit/{auditId}/csv",
  "method": "GET"
}

> - Generate an audit showing all actions taken in the system.  
{
  "path": "/system/audit",
  "method": "POST"
}

> - Retrieve the results of a generated system audit.  
{
  "path": "/system/audit/{auditId}/csv",
  "method": "GET"
}  

5. If your local laws and regulations allows for or mandates the deletion of case evidence, set deletionAllowed field to true, otherwise set it to false.
6. Go to the front end UI to change the System Use Notification.
CJIS Policy 5.4 Use Notification states that you must display an approved system use notification message befor granting access, informing users of various usages and monitoring rules.

The message should generally discuss the following information: that the user is accessing a restricted information system; that system usage may be monitored, recorded, and subject to audit; that unauthorized use of the system is prohibited and may be subject to criminal and/or civil penalties; use of the system indicateds consent to monitoring and recording.

Additionally the message shall provide appropriate privacy and security notices based on local laws and regulations. Please refer to CJIS Policy 5.4 for the most up to date information.

To input your System Use Notification Message, open the following file in a text editor:

**Windows**
```sh
notepad ./dea-ui/ui/src/common/labels.tsx
```

**Linux**
```sh
nano  ~/digital-evidence-archive-on-aws/source/dea-ui/ui/src/common/labels.tsx
```

Scroll to the systemUseNotificationText definition, and change the text starting with CUSTOMIZE YOUR SYSTEM USE NOTIFICATION TEXT… to your approved system message. Save your changes

### Step 3: Launch the Stack

Navigate to the dea-main folder
```sh
cd ./dea-main
```

Export the following variables (customize as needed)

**Windows**
```sh
set STAGE=prod
set AWS_REGION=us-east-2
set DEA_CUSTOM_DOMAIN=<true if using custom domain, otherwise do NOT set>
set AWS_ACCT_NUMBER=<your 12 digit AWS account number>
```

**Linux**
```sh
export STAGE=prod
export AWS_REGION="us-east-2"
export DEA_CUSTOM_DOMAIN=<true if using custom domain, otherwise do NOT set>
export AWS_ACCT_NUMBER=<your 12 digit AWS account number>
```

Now run the following commands to launch the stack

**Windows**
```sh
rush rebuild
rushx cdk bootstrap aws://%AWS_ACCT_NUMBER%/%AWS_REGION%
rushx cdk deploy
```

**Linux**
```sh
rush rebuild
rushx cdk bootstrap aws://${AWS_ACCT_NUMBER}/${AWS_REGION}
rushx cdk deploy
```

NOTE: if you are running cdk deploy in us-gov-east-1 region, run the command with the --all flag since you are deploying more than one stack. E.g.
```sh
rushx cdk deploy --all
```

After the command is done, copy the list of outputs somewhere safe, You will need them for next steps.

### Step 4: Integrate your CJIS Compliant Identity Provider
Cognito is not CJIS compliant, therefore you need to use your CJIS Compliant IdP to federate with Cognito for use in DEA. This will require you to create an App Integration in your IdP, relaunch the stack, create a custom attribute for users called DEARole, and assign users to DEA via the App Integration.

1) First in your IdP, create a new custom attribute for users called DEARole, limit the possible values to only the Roles you configured in step 3.
* Okta: https://help.okta.com/en-us/Content/Topics/users-groups-profiles/usgp-add-custom-user-attributes.htm
* Active Directory: https://windowstechno.com/how-to-create-custom-attributes-in-active-directory/

2) Add the new user pool as a SAML 2.0 enterprise application in your IdP. For this you will need your cognito domain prefix (as you stated in your configuration file) and your user pool Id (listed in the named CDK outputs as DeaAuthConstructuserPoolId).
AWS has articles on how to integrate Okta and Active Directory with Cognito for Federation. See below for links. NOTE: DEA has already created the User Pool and App Client for you skip those steps. 

* For Okta: Complete ONLY the steps "Create a SAML app in Okta" and "Configure SAML integration for your Okta App" in https://repost.aws/knowledge-center/cognito-okta-saml-identity-provider.
** For Attribute Statements, ensure you have the following fields: first name, last name, email, username, DEARole (the custom attribute you created in step 1)
* For Active Directory: Complete ONLY Step 2: Add Amazon Cognito as an entrpise application in Azure AD in the following article https://aws.amazon.com/blogs/security/how-to-set-up-amazon-cognito-for-federated-authentication-using-azure-ad/.
** For User Attributes and Claims,, ensure you have the following fields: first name, last name, email, username, DEARole (the custom attribute you created in step 1)

One you have created the SAML 2.0 integration in your IdP, with the appropriate User Attribute Mapping, you can now start the integration process with DEA.

3) Open your configuration file from step 3 and add the following (with your specific values for each of the fields) to the configuration file.
* metadataPath : the URL link to the IdP App Integration Metadata (recommended) or the path to the metadata file locally
* metadataPathType: either URL or FILE
* attributeMap: mapping from what Cognito fields are named to what you named them in your App Integration (App Integration names are on right hand side, do not modify left hand side)

E.g.
```
"idpInfo": {
  "metadataPath": <URL link to IdP metatdata, or path to the file locally>
  "metadataPathType": "URL", // or “FILE” if you used the path to the metadata file locally
  "attributeMap": {
    "username": "username",
    "email": "email",
    "firstName": "firstName",
    "lastName": "lastName",
    "deaRoleName": "DEARole"
  }
}
```

4) Update the stack to use the information you provided in the configuration file to integrate your IdP with the DEA stack. Run the following commands:

**Windows**
```sh
rush rebuild
rushx cdk bootstrap aws://%AWS_ACCT_NUMBER%/%AWS_REGION%
rushx cdk deploy
```

**Linux**
```sh
rush rebuild
rushx cdk bootstrap aws://${AWS_ACCT_NUMBER}/${AWS_REGION}
rushx cdk deploy
```

NOTE: if you are running cdk deploy in us-gov-east-1 region, run the command with the --all flag since you are deploying more than one stack. E.g.
```sh
rushx cdk deploy --all
```

5) Save your Configuration File

Save your configuration file somewhere safe, like s3, so you can reuse it when you want to update your stack.

6) Post Deployment Steps:

**DEA Permissions Boundary**

The CDK stack for DEA also creates a permissions boundary that blocks all access to protected DEA resources. Cloudtrail is enabled for DEA resources, so all access outside of DEA will be logged. However, for extra security you can attach the Permissions Boundary to all Console IAM Roles to block access to DEA resources.

Log in as Admin in your AWS account.
1. Go to IAM.
2. Go to Users. (Alternately, go to Roles to set permissions boundaries around a role.)
3. Choose a user.
4. Go to Permissions Boundary, and choose set permissions boundary.
5. In the search bar, enter deaResourcesPermissionsBoundary and choose it.
6. Choose Set boundary.

Repeat steps 3-6 for each User (or Role that users have access to).

**Enable AWS WAF**

Digital Evidence Archive on AWS allows configuration of AWS Web Application Firewall (WAF) to protect the DEA-created Amazon API Gateway. Please see this documentation for more information on how you can protect your deployment:
*https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html
*https://repost.aws/knowledge-center/waf-apply-rate-limit

Please note that default DEA limits are conservative, but you can increase the numbers alongside the lambda service limit increases. Fine-grain throttle limits using WAF.

**Anti-virus**

DEA does not protect against uploading viruses (as they can be considered evidence in certain investigations), therefore we recommend setting up anti-virus and other security protections, such as crowdstrike to ensure your Criminal Justice devices stay secure. A common product is Crowdstrike.

## Simple Deployment

Deployments are controlled by your `STAGE` environment variable. If unspecified this will default to `devsample`.
Any deployments cohabitating on a single AWS account will require an account-unique `STAGE` name.
By default the build process will seek a configuration file ([example](/source/common/config/devsample.json)) with the same name as your `STAGE`, however, you can optionally specify `CONFIGNAME` in your environment to specify a filename separate from your `STAGE`, this is useful if you want multiple stages that share the same configuration.
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

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

http://www.apache.org/licenses/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License.
