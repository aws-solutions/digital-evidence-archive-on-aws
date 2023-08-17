#!/bin/bash
#
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh
#

# Get reference for all important folders
template_dir="$PWD"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "Install packages"
echo "------------------------------------------------------------------------------"
npm install -g @microsoft/rush
npm install -g pnpm@7.16.0
npm install -g aws-cdk@2.76.0
echo "------------------------------------------------------------------------------"
echo "Install Run Unit Tests"
echo "------------------------------------------------------------------------------"
cd $source_dir
rush purge
rush update
rush build
rush test:sonar
echo "Test Complete"