#!/bin/bash

PREFIX="${STAGE:-chewbacca}"
export DEA_API_URL=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${PREFIX}-deaApiUrl'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export IDENTITY_POOL_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${PREFIX}-identityPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${PREFIX}-userPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_CLIENT_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${PREFIX}-userPoolClientId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
