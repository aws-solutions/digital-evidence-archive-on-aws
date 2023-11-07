# Digital Evidence Archive

Digital Evidence Archive on AWS enables Law Enforcement organizations to ingest evidence data to aid digital data management

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-94.58%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-81.58%25-yellow.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-93.14%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-94.54%25-brightgreen.svg?style=flat) |


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


> :warning: To compile a comprehensive Audit Log of application events Digital Evidence Archive utilizes both Application-Generated events as well as events from CloudTrail. CloudTrail events have been known to be delayed up to 20 minutes before becoming present in CloudWatch Logs. Consequently, be aware that a generated Audit report may be missing events that have occurred recently.

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

Validate your configuration file and address any errors that appear

```sh
rushx validate:config
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

1) First in your IdP, create a new custom attribute for users called DEARole, limit the possible values to only the Roles you configured in step 3. (For example: for the prodexample.json, the only possible attribute values would be CaseWorker, EvidenceManager, and WorkingManager)
* Okta: https://help.okta.com/en-us/Content/Topics/users-groups-profiles/usgp-add-custom-user-attributes.htm
* Active Directory: https://windowstechno.com/how-to-create-custom-attributes-in-active-directory/

2) Add the new user pool as a SAML 2.0 enterprise application in your IdP. For this you will need your cognito domain prefix (as you stated in your configuration file) and your user pool Id (listed in the named CDK outputs as DeaAuthConstructuserPoolId).
AWS has articles on how to integrate Okta and Active Directory with Cognito for Federation. See below for links. NOTE: DEA has already created the User Pool and App Client for you skip those steps. 

Below are the links to articles on how to connect your IdP to the Cognito User Pool. You will need the following two values for the SAML Application you will create in your IdP:
* Single sign on URL: replace DOMAIN_PREFIX with the cognito domain you defined in your configuration file, and REGION with the region you are deploying in (e.g. us-east-1)
  - For non-Gov Cloud regions: 
   https://DOMAIN_PREFIX.auth.REGION.amazoncognito.com/saml2/idpresponse
  - For Gov Cloud regions: 
  https://DOMAIN_PREFIX.auth-fips.REGION.amazoncognito.com/saml2/idpresponse
* Audience URL: urn:amazon:cognito:sp:USER_POOL_ID (replace USER_POOL_ID with the id listed in the named CDK outputs called DeaAuthConstructuserPoolId)

* For Okta: 
Complete ONLY the steps "Create a SAML app in Okta" and "Configure SAML integration for your Okta App" in https://repost.aws/knowledge-center/cognito-okta-saml-identity-provider.
- For Attribute Statements, ensure you have the following fields: first name, last name, email, username, DEARole (the custom attribute you created in step 1)

* For Active Directory: Complete ONLY Step 2: Add Amazon Cognito as an entrpise application in Azure AD in the following article https://aws.amazon.com/blogs/security/how-to-set-up-amazon-cognito-for-federated-authentication-using-azure-ad/.
- For User Attributes and Claims, ensure you have the following fields: first name, last name, email, username, DEARole (the custom attribute you created in step 1)

One you have created the SAML 2.0 integration in your IdP, with the appropriate User Attribute Mapping, you can now start the integration process with DEA.

3) Open your configuration file from step 3 and add the following (with your specific values for each of the fields) to the configuration file.
* metadataPath : the URL link to the IdP App Integration Metadata (recommended) or the path to the metadata file locally
* metadataPathType: either URL or FILE
* attributeMap: mapping from what Cognito fields are named to what you named them in your App Integration (App Integration names are on right hand side, do not modify left hand side)

E.g.
```
"idpInfo": {
  "metadataPath": "<URL link to IdP metatdata>",
  "metadataPathType": "URL",
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

```sh
rush rebuild
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
# Additional Documentation
## [Local Development](/docs/LOCALDEV.md)

## [Operating your Digital Evidence Archive Instance](/docs/OPERATIONS.md)

## [Known Issues](/docs/KNOWN_ISSUES.md)

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

http://www.apache.org/licenses/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License.
