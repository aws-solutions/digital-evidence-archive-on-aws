#!/bin/bash

export DEA_API_URL=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == 'deaApiUrl'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export IDENTITY_POOL_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == 'identityPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == 'userPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_CLIENT_ID=$(aws cloudformation list-exports --region us-east-1 --query """Exports[?Name == 'userPoolClientId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export TEST1="TEST1"
