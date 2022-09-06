#!/bin/bash
set -e
# This script initializes a git repo using the current directory name as the solution name. It also stages the /source
# directory with a ready-to-use CDK project structure and artifacts, as well as a sample Lambda function.

sedi()
{
    # cross-platform for sed -i
    sed -i $* 2>/dev/null || sed -i "" $*
}

# This script initializes a git repo using the current directory name as the solution name.
solution_name=`echo ${PWD##*/} | tr '[:upper:]' '[:lower:]'`

# Get reference for all important folders
project_root="$PWD"

echo "Solution S3 location will be configured to this repo name: $solution_name"
echo "Please provide the solution ID (e.g. SO0xyz):"
read solution_id
echo "Please specify the language to be used for the CDK project (choices: [typescript]):"
read solution_cdk_language
echo "Please specify the CDK version to be used (current @aws-solutions-constructs latest version: $(npm show @aws-solutions-constructs/core version)):"
read solution_cdk_version
if [ $solution_cdk_language = "typescript" ]; then
  echo "Would you like to initialize the source code package? (y/n):"
  read initialize_source
fi
echo "Please provide a solution name for the README.md file:"
read readme_name
echo "Please provide an initial description for the README.md file:"
read solution_description
echo "Please provide the solution version:"
read solution_version

# Setup the /source directory with the resources from the appropriate programming language (for CDK, not underlying
# Lambda functions or other services)
if [ $solution_cdk_language = "typescript" ]; then
  # Extract the .typescript source code package into /source
  cp -a $project_root/source/.typescript/. $project_root/source
  # Extract the .typescript deployment package into /deployment
  cp -a $project_root/deployment/.typescript/. $project_root/deployment
fi

# Update build-s3-dist.sh with $solution_name
replace="s/%%SOLUTION_NAME%%/$solution_name/g"

# Update build-s3-dist.sh and package files with $solution_cdk_version
echo "sedi "s/%%CDK_VERSION%%/$solution_cdk_version/g" **/package.json"
sedi "s/%%CDK_VERSION%%/$solution_cdk_version/g" **/package.json
echo "sedi "s/%%CDK_VERSION%%/$solution_cdk_version/g" **/build-s3-dist.sh"
sedi "s/%%CDK_VERSION%%/$solution_cdk_version/g" **/build-s3-dist.sh

# Update CONTRIBUTING.md from $solution_name
echo "sedi $replace CONTRIBUTING.md"
sedi $replace CONTRIBUTING.md

# Update README.md solution name with $readme_name
replace="s/%%SOLUTION_NAME%%/$readme_name/g"
echo "sedi '$replace' README.md"
sedi "$replace" README.md

# Update solution name in cdk.json
echo "sedi '$replace' '$project_root'/source/cdk.json"
sedi "$replace $project_root/source/cdk.json"

# Update NOTICE.txt from $solution_name
echo "sedi $replace NOTICE.txt"
sedi "$replace" NOTICE.txt

# Update README.md description with $solution_description
replace="s/%%SOLUTION_DESCRIPTION%%/$solution_description/g"
echo "sedi '$replace' README.md"
sedi "$replace" README.md

# Update solution id in cdk.json
replace="s/%%SOLUTION_ID%%/$solution_id/g"
echo "sedi '$replace' '$project_root'/source/cdk.json"
sedi "$replace $project_root/source/cdk.json"

cleanup_bootstrap_files() {
  # Remove the source language staging files
  rm -rf $project_root/source/.typescript
  rm -rf $project_root/source/.python

  # Remove the deployment language staging files
  rm -rf $project_root/deployment/.typescript
  rm -rf $project_root/deployment/.python

  # Remove copy-repo.sh script
  rm copy-repo.sh

  # Remove this initalization script
  rm initialize-repo.sh

}

# cleanup and remove bootstrap files in the solution initiatialization package
cleanup_bootstrap_files
