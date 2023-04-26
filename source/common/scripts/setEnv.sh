#!/bin/bash

STACKPREFIX="${STAGE:-chewbacca}"
REGION="${AWS_REGION:-us-east-1}"

profile_string=$([ -z $AWS_PROFILE ] && echo "--profile $AWS_PROFILE")

export DEA_API_URL=$(aws cloudformation list-exports --region $REGION  $profile_string --query """Exports[?Name == '${STACKPREFIX}-deaApiUrl'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export IDENTITY_POOL_ID=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-identityPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_ID=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-userPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_CLIENT_ID=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-userPoolClientId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export DATASETS_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-DeaS3Datasets'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
