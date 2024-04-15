# Digital Evidence Archive

Digital Evidence Archive on AWS enables Law Enforcement organizations to ingest evidence data to aid digital data management

# Code Coverage

| Statements                                                                               | Branches                                                                             | Functions                                                                              | Lines                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Statements](https://img.shields.io/badge/statements-92.3%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-76.54%25-red.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-92.16%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-92.2%25-brightgreen.svg?style=flat) |

# Getting Started

## Production Deployment

Follow these steps to deploy your production environment. If developing/testing, follow the Simple Deployment Section.

You can deploy using your local computer via the terminal (for Mac/Linux users) or Command Prompt for Windows Users. The commands in the following steps may use different commands depending on which OS your computer is running, so make sure to follow the directions carefully.

### Step 0: Setup a Custom Domain (Recommended)

We recommend using a custom domain, since the default URL for this solution is not human readable and is limited to [older TLS versions with known vulnerabilities](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-custom-domain-tls-version.html). You will need to register a domain using AWS Route53 or other provider, and import a certificate for the domain using AWS Certificate Manager.

#### Option 1: Using a Route53 Domain

1. Register a Domain with Route53 by following [this guide](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html#register_new_console).
2. Wait for confirmation email
3. Keep Note of the domain name (e.g. <digitalevidencearchive.com>)
4. Route53 automatically creates a hosted zone for your domain. Go to Route 53, click HostedZones on the left tab. Go to the hosted zone that matches your domain name, and copy and paste the Hosted Zone ID somewhere safe
5. Next go to AWS Certificate Manager to [request a certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html) for your domain. MAKE SURE TO DO IT IN THE REGION YOU WANT TO DEPLOY.
6. Navigate to the certificate table. The request should be pending. Click on the Certificate ID link, scroll to the Domains section, and on the upper right hand side of that section, click Create Records in Route53. Wait about 10 minutes
7. Once the Certificate is issued, click the Certificate ID link and copy the ARN in the first section. Save this somewhere safe.

#### Option 2: Using a non-Route53 Domain

1. Get a certificate for your domain by following [this guide](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html).
 -- NOTE: make sure you create the certificate in the same region as the solution deployment
 -- Alternatively, you can [import a certificate from a third party.](https://docs.aws.amazon.com/acm/latest/userguide/import-certificate.html).
2. After the certificate is created, copy the ARN of the certificate and save it somewhere, you will need it for step 2.
3. After the deployment is complete in step 3, you will have to add a CNAME record to point the domain at the solution. Follow the last instruction in Step 3.

### Pre-requisites

**NOTE** If you are using Windows to deploy, make sure that for each of your installation steps the download path DOES NOT contain spaces. Many of the default paths go to "C:\Program Files\", but certain commands cannot run when the path has a space in it

1. You will need npm and node installed on your machine:

*For Windows*

Download the [nvm-setup.exe file](https://github.com/coreybutler/nvm-windows/releases) for the most recent release.

The Setup-NVM-for-Windows installation wizard will walk you through the setup steps, including choosing the directory where both nvm-windows and Node.js will be installed.
**NOTE**: During the nvm install, when asked where to place npm, **DO NOT** place in "C:/Program Files", instead you can put it in "C:\Users\Public\nodejs".

Additionally we currently require Node 18 LTS (lts/hydrogen). If you have already cloned the repository, you can automatically use our recommended version with the `nvm install` command which will install the version we've defined in our nvmrc file. Otherwise run

```sh
nvm install v18.19.1
nvm use v18.19.1
```

*For Mac/Linux*

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
source ~/.bashrc
nvm install v18.19.1
nvm use v18.19.1
```

2. Next you need to install rush to be able to run commands in the repository, cdk for deployment, and a specific version of pnpm (Note pnpm needs to match the version pnpmVersion in rush.json).

```sh
npm install -g @microsoft/rush
npm install -g pnpm@7.16.0
npm install -g aws-cdk
```

3. Ensure you have AWS Command Line Interface (AWS CLI) installed, and have your aws credentials set. 

You can see [here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) for more information about installing AWS CLI.
**NOTE**: Make sure you change the download location to ensure the path **DOES NOT** have any spaces. On windows, you can use ""C:\Users\Public\Amazon\AWSCLIV2\"

You can see [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html) for options to set your aws credentials. You may want to ask your AWS account owner for which option to use.

4. You'll need to pull the repository to your local machine, therefore you also need git installed.

Check if already present:
```sh
git --version
```

If you do not already have it on your machine you can follow the instructions for your OS [here](https://github.com/git-guides/install-git).

5. For Windows you will need to install Cygwin so certains scripts can run during the build process. See [here](https://www.cygwin.com/) for installation details.

6. If you are using Windows, you may need to restart your command prompt to see the installation changes take place.

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
cd .\common\config
copy prodexample.json prod.json
cd ..\..
notepad .\common\config\prod.json
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
"cognito": {
  "domain": "exampleexampleexample"
},
```

3. If you completed step 0, then import the domainName and ACM Certificate ARN (and hostedZoneId, hostedZoneName for Route53 domains)

Route 53 Domains:

```
"customDomain": {
  "domainName": "example.com",
  "certificateArn": "arn:aws:acm:us-east-1:ACCTNUM:certificate/CERT_NUM",
  "hostedZoneId": "NJKVNFJKNVJF345903",
  "hostedZoneName": "example.com"
},
```

Non Route53 Domains:

```
"customDomain": {
  "domainName": "example.com",
  "certificateArn": "arn:aws:acm:us-east-1:ACCTNUM:certificate/CERT_NUM"
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

**Windows Powershell**

```sh
$Env:STAGE='prod'
$Env:AWS_REGION='us-east-2'
$Env:DEA_CUSTOM_DOMAIN=<'true' if using custom domain, otherwise do NOT set>
$Env:AWS_ACCT_NUMBER=<'your 12 digit AWS account number'>
```

**Linux**

```sh
export STAGE=prod
export AWS_REGION="us-east-2"
export DEA_CUSTOM_DOMAIN=<true if using custom domain, otherwise do NOT set>
export AWS_ACCT_NUMBER=<your 12 digit AWS account number>
```

**Optional**

If you plan on using the Mass Data Ingestion feature to import data into DEA, then set your admin role ARN to the account that DEA will be hosted on

**Windows Powershell**

```sh
$Env:ADMIN_ROLE_ARN=<'Your DEA AWS Account admin role arn. Example: arn:aws:iam::<aws account number>:role/Admin'>
```

**Linux**

```sh
export ADMIN_ROLE_ARN=<'Your DEA AWS Account admin role arn. Example: arn:aws:iam::<aws account number>:role/Admin'>
```

Validate your configuration file and address any errors that appear

```sh
rushx validate:config
```

Now run the following commands to launch the stack

**Windows**

```sh
rush rebuild
rushx cdk bootstrap aws://$env:AWS_ACCT_NUMBER/$env:AWS_REGION
rushx cdk deploy
```

**Linux**

```sh
rush rebuild
rushx cdk bootstrap aws://${AWS_ACCT_NUMBER}/${AWS_REGION}
rushx cdk:deploy
```

NOTE: if you are running cdk deploy in us-gov-east-1 region, run the command with the --all flag since you are deploying more than one stack. E.g.

```sh
rushx cdk deploy --all
```

After the command is done, copy the list of outputs somewhere safe, You will need them for next steps.

NOTE: If you used a non-Route53 domain, then after the deployment is complete, you must add a CNAME alias to point your domain at the solution. To do this you will need the API Gateway Domain Name for the custom domain, which you can find by going to API Gateway on the console, selecting "Custom domain names" on the left hand side, and selecting the domain name; the API Gateway Domain Name will be under the Configurations tab in the second box. It should look something like: d-rtxxxxxxxx.execute-api.us-east-1.amazonaws.com.

NOTE: For custom domains, you can access the solution using your domain; to view the ui, append the url with '/ui': e.g. dea.digitalevidencearchive.com/ui

### Step 4: Integrate your CJIS Compliant Identity Provider

Cognito is not CJIS compliant, therefore you need to use your CJIS Compliant IdP to federate with Cognito for use in DEA. This will require you to create an App Integration in your IdP, relaunch the stack, create a custom attribute for users called DEARole, and assign users to DEA via the App Integration.

#### 4.1: IdP Side Integration

The solution can integrate with either Okta or Identity Center (if you use Active Directory, you can integrate it with IdentityCenter). You can also choose how to determine what access the user has to the solution either by defining rules based on
user group membership or by defining a custom attribute on your IdP, and for each dea user
assigning the role name to that attribute for the user. See below for more details.

##### Integrating with Okta

###### Create Attribute in Okta

If you are using group membership to define access to DEA, you can skip this step.

Otherwise, in Okta create a new custom attribute for users called DEARole, limit the possible values to only the Roles you configured in step 3. (For example: for the prodexample.json, the only possible attribute values would be CaseWorker, EvidenceManager, and WorkingManager). You can follow the instructions for doing that [here](https://help.okta.com/en-us/Content/Topics/users-groups-profiles/usgp-add-custom-user-attributes.htm).

###### Create SAML 2.0 Application in Okta

You will need your cognito domain prefix (as you stated in your configuration file) and your user pool Id (listed in the named CDK outputs as DeaAuthConstructuserPoolId).

Complete ONLY the steps "Create a SAML app in Okta" and "Configure SAML integration for your Okta App" in this [aws article](https://repost.aws/knowledge-center/cognito-okta-saml-identity-provider).
Use the Following Values:

- Single sign on URL: replace DOMAIN_PREFIX with the cognito domain you defined in your configuration file, and REGION with the region you are deploying in (e.g. us-east-1)
  - For non-US GovCloud regions or regions/stacks not using [FIPS endpoints](https://aws.amazon.com/compliance/fips/):
   <https://DOMAIN_PREFIX.auth.REGION.amazoncognito.com/saml2/idpresponse>
  - For US regions:
  <https://DOMAIN_PREFIX.auth-fips.REGION.amazoncognito.com/saml2/idpresponse>
- Audience URL: urn:amazon:cognito:sp:USER_POOL_ID (replace USER_POOL_ID with the id listed in the named CDK outputs called DeaAuthConstructuserPoolId, should look like us-east-1_xxxxxxxxx)
- Attribute Statements: Set the following Attributes
  - firstName
  - lastName
  - email
  - username
  - If using Custom Attribute: the name of the custom attribute you created, e.g. deaRole
- If using Groups: add a Group Claim
  - E.g. send all groups: Name=groups, NameFormat=Unspecified, Filter: Select Matches regex Value=.*

###### Configuring DEA to connect with IdP

One you have created the SAML 2.0 integration in your IdP, with the appropriate User Attribute Mapping, you can now start the integration process with DEA.

Open your configuration file from step 3 and add the following (with your specific values for each of the fields) to the configuration file.

- metadataPath : the URL link to the IdP App Integration Metadata (recommended) or the path to the metadata file locally
- metadataPathType: either URL or FILE
- attributeMap: mapping from what Cognito fields are named to what you named them in your App Integration (App Integration names are on right hand side, do not modify left hand side)
- Optional: you can set the default role, so if no rule mapping matches during federation, the user gets defined the default role. If not set, the default role is NO access to DEA

e.g. Using Custom Attribute

```prod.json
"idpInfo": {
  "metadataPath": "<URL link to IdP metatdata>",
  "metadataPathType": "URL",
  "attributeMap": {
    "username": "username",
    "email": "email",
    "firstName": "firstName",
    "lastName": "lastName",
    "deaRoleName": "DEARole"
  },
  "defaultRole": 'CaseWorker'
}
```

e.g. Using Group Membership

For each rule your define the deaRoleName (one ofthe roles you defined in Step 3, e.g. CaseWorker, EvidenceManager) and the FilterValue (a string you want to search for in groups). For example if my filterValue is Troop and the deaRole is CaseWorker, then if the user's group contains the string Troop they will be assigned the CaseWorker role in the system.

NOTE: You can define up to 25 GroupToDeaRoleRules, and they are evaluated in order.

```prod.json
  "idpInfo": {
    "metadataPath": "<URL link to IdP metatdata>",
    "metadataPathType": "URL",
    "attributeMap": {
      "username": "username",
      "email": "email",
      "firstName": "firstname",
      "lastName": "lastname",
      "groups": "groups"
    },
    "groupToDeaRoleRules": [
      {
        "filterValue": "DEAEvidenceManager",
        "deaRoleName": "EvidenceManager"
      },
      {
        "filterValue": "SuperUser",
        "deaRoleName": "WorkingManager"
      },
      {
        "filterValue": "DEA",
        "deaRoleName": "CaseWorker"
      }
    ],
    "defaultRole": 'CaseWorker'
  },
```

Proceed to [Relaunch Stack to Update with Authentication Information](#4.2:-Relaunch-Stack-to-Update-with-Authentication-Information)

##### Integrating with Identity Center

###### Enable IAM Identity Center

When first enabling Identity Center in a region, you will need to select "Enable with AWS Organizations", not "Enable in only this AWS account".

###### Sync Active Directory or external Identity Provider to Identity Center

You will need to connect an Active Directory or Identity Provider (IdP) with IAM Identity Center.

For a self-managed directory or an AWS Managed Microsoft AD, see [this guide](https://docs.aws.amazon.com/singlesignon/latest/userguide/manage-your-identity-source-ad.html). You may also choose to first import an existing Microsoft Active Directory into [AWS Managed Microsoft AD](https://docs.aws.amazon.com/directoryservice/latest/admin-guide/ms_ad_getting_started.html). Ensure that your AD users are synced in Identity Center by following [this guide](https://docs.aws.amazon.com/singlesignon/latest/userguide/provision-users-from-ad-configurable-ADsync.html?icmpid=docs_sso_console#manage-sync-add-users-groups-configurable-ADsync).

For an external identity provider, see [this guide](https://docs.aws.amazon.com/singlesignon/latest/userguide/manage-your-identity-source-idp.html?icmpid=docs_sso_console).

###### Create SAML 2.0 Application in Identity Center

You will need your cognito domain prefix (as you specified in your configuration file) and your user pool Id (listed in the named CDK outputs as DeaAuthConstructuserPoolId).

Complete ONLY the step titled ["Configure a SAML application from the IAM Identity Center console"](https://repost.aws/knowledge-center/cognito-user-pool-iam-integration).

Use the following values in your newly created "Customer managed application".

- Single sign on URL: replace DOMAIN_PREFIX with the cognito domain you defined in your configuration file, and REGION with the region you are deploying in (e.g. us-east-1)
  - For non-US Cloud regions or regions/stacks not using FIPS endpoints: `https://DOMAIN_PREFIX.auth.REGION.amazoncognito.com/saml2/idpresponse`
  - For US regions: `https://DOMAIN_PREFIX.auth-fips.REGION.amazoncognito.com/saml2/idpresponse`
- Audience URL: `urn:amazon:cognito:sp:USER_POOL_ID`
  - Replace USER_POOL_ID with the id listed in the named CDK outputs called DeaAuthConstructuserPoolId, should look like us-east-1_xxxxxxxxx
- Attribute Statements: Set the following attribute mappings:
  - Subject --> ${user:subject} --> persistent
  - firstname  --> ${user:givenName} --> basic  
  - lastname --> ${user:familyName} --> basic
  - email --> ${user:email} --> basic
  - username --> ${user:preferredUsername} --> basic
  - idcenterid --> ${user:AD_GUID} --> basic
- Note: Do NOT try to add groups or another custom attribute here as it will not work. Identity Center does not allow for sending user groups and/or custom attribute over the SAML assertion. To get around this, when you integrate with Identity Center, the DEA solution will create a PreTokenGeneration Cognito Trigger, which will query your identity store for the federated user's group memberships, and add those groups to the identity token, so authorization can happen just like Okta/AD integrations.

###### Sync Users & Groups (Active Directory only)

Finally, under "Assigned users and groups", ensure your users and groups are added. For example, if you created an `IAMIdentityCenterAllUsersAndGroups` group in your Microsoft AD and synced it, ensure that group is added for all of your users to be able to login to the DEA application itself.

In the next step, we will configure what users and groups are allowed to do once logged into DEA.

###### Configuring DEA to connect with IdP

- Take note of your identity store id, which you can find by going to Settings within Identity Center, in the second box under the tab "Identity Source", as Identity Store Id. It should look something like d-01234abcd5.
  - If your identity store is a [Microsoft Active Directory](https://aws.amazon.com/directoryservice/active-directory/), ensure `hasAwsManagedActiveDirectory` is set to `true`. We recommend managing all users and groups in [AWS Managed Microsoft Active Directory](https://docs.aws.amazon.com/directoryservice/latest/admin-guide/directory_microsoft_ad.html). Ensure the Managed Active Directory is in the same region as set by your "identityStoreRegion" variable and in the same account as set by your "identityStoreAccountId" variable.
  - DEA does not support [AD Connector](https://docs.aws.amazon.com/directoryservice/latest/admin-guide/directory_ad_connector.html) or [Simple AD](https://docs.aws.amazon.com/directoryservice/latest/admin-guide/directory_simple_ad.html).
- Next add the Identity Center SAML Application URL to the configuration file. You can find this URL in your Identity Center's customer managed application (the app you just made) -> Edit configuration -> IAM Identity Center metadata -> "IAM Identity Center SAML metadata file".
- Fill in the metadata path and identity store id, and define your group rules.
  - For each rule you define the deaRoleName (one of the roles you specified in Step 3, e.g. CaseWorker, EvidenceManager) and the FilterValue (a string you want to search for in groups). For example if the filterValue is Troop and the deaRole is CaseWorker, then if the user's group contains the string "Troop" they will be assigned the CaseWorker role in the system.
  - NOTE: You can define up to 25 GroupToDeaRoleRules, and they are evaluated in order.

An example is given below. Please append this to your configuration file.

```prod.json
  "idpInfo": {
    "identityStoreId": "<Identity Store Id>",
    "identityStoreRegion": "<Identity Store Region>",
    "identityStoreAccountId": "<Identity Store AWS Account Id>",
    "hasAwsManagedActiveDirectory": <true if using AWS Managed Microsoft AD as identity store, defaulted to false>,
    "metadataPath": "<URL link to IdP metatdata>",
    "metadataPathType": "URL",
    "attributeMap": {
      "idcenterid": "idcenterid",
      "username": "username",
      "email": "email",
      "firstName": "firstname",
      "lastName": "lastname"
    },
    "groupToDeaRoleRules": [
      {
        "filterValue": "DEAEvidenceManager",
        "deaRoleName": "EvidenceManager"
      },
      {
        "filterValue": "SuperUser",
        "deaRoleName": "WorkingManager"
      },
      {
        "filterValue": "DEA",
        "deaRoleName": "CaseWorker"
      }
    ]
  },
 ```

Proceed to [Relaunch Stack to Update with Authentication Information](#4.2:-Relaunch-Stack-to-Update-with-Authentication-Information)

#### 4.2: Relaunch Stack to Update with Authentication Information

Update the stack to use the information you provided in the configuration file to integrate your IdP with the DEA stack. Run the following commands:

```sh
rush rebuild
rushx cdk deploy
```

NOTE: if you are running cdk deploy in us-gov-east-1 region, run the command with the --all flag since you are deploying more than one stack. E.g.

```sh
rushx cdk deploy --all
```

### Step 5: Save your Configuration File

Save your configuration file somewhere safe, like s3, so you can reuse it when you want to update your stack.

### Step 6:  Post Deployment Steps

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
*<https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-request-throttling.html>
*<https://repost.aws/knowledge-center/waf-apply-rate-limit>

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

# Step 7 : Data Vaults - Mass Data Ingestion

To enable mass data ingestion, ensure you have deployed DEA with the ADMIN_ROLE_ARN. This will enable your account to see the DEA Datasets S3 bucket in DataSync to create a location for task transfers.

For more details on performing a DataSync transfer into DEA, please refer to the [implementation guide.](https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html)

**Mass Case Creation**
To create cases based on folders imported to a Data Vault via DataSync. We have provided an example script that you may use as reference. [case association script](/source/dea-app/src/app/migrations/examples/mass-case-association.ts)

The example script is using cognito for authentication. If your DEA is configured with IDP, modifications will be required to allow the script to authenticate with DEA.

# Additional Documentation

## [Local Development](/docs/LOCALDEV.md)

## [Operating your Digital Evidence Archive Instance](/docs/OPERATIONS.md)

## [Known Issues](/docs/KNOWN_ISSUES.md)

Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

<http://www.apache.org/licenses/>

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License.

## Collection of Anonymous Operational Metrics
This solution collects anonymous operational metrics to help AWS improve the quality of features of the solution. For more information, including how to disable
this capability, please see the [implementation guide](https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html).
