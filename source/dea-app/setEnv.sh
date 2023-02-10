#!/bin/bash

STACKPREFIX="${STAGE:-chewbacca}"
export DEA_API_URL=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${STACKPREFIX}-deaApiUrl'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export IDENTITY_POOL_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${STACKPREFIX}-identityPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${STACKPREFIX}-userPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_CLIENT_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${STACKPREFIX}-userPoolClientId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export DOMAIN_PREFIX=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == '${STACKPREFIX}-cognitoDomainPrefix'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
