#!/usr/bin/env bash

export ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

read -p "Deploying to PROFILE/ACCOUNT: ${AWS_PROFILE}/${ACCOUNT_ID}, STAGE: ${STAGE}, PREFIX: ${DOMAIN_PREFIX}, AWS_USE_FIPS_ENDPOINT: ${AWS_USE_FIPS_ENDPOINT} (Proceed? [Y/n]) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
  echo "Deploying..."
else
  echo "Aborting..."
  exit 1
fi