#! /bin/bash

STACKPREFIX="${STAGE:-devsample}"
REGION="${AWS_REGION:-us-east-1}"

profile_string=$(if [ -n "$AWS_PROFILE" ]; then echo "--profile $AWS_PROFILE"; fi)
# cognito is not available in us-gov-east-1. If that is the target deployment region, we'll deploy cognito into us-gov-west-1
cognito_region=$([ "$REGION" = "us-gov-east-1" ] && echo "us-gov-west-1" || echo "$REGION")

export DEA_API_URL=$(aws cloudformation list-exports --region $REGION  $profile_string --query """Exports[?Name == '${STACKPREFIX}-deaApiUrl'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export IDENTITY_POOL_ID=$(aws cloudformation list-exports --region $cognito_region $profile_string --query """Exports[?Name == '${STACKPREFIX}-identityPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_ID=$(aws cloudformation list-exports --region $cognito_region $profile_string --query """Exports[?Name == '${STACKPREFIX}-userPoolId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//') 
export USER_POOL_CLIENT_ID=$(aws cloudformation list-exports --region $cognito_region $profile_string --query """Exports[?Name == '${STACKPREFIX}-userPoolClientId'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export DATASETS_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-DeaS3Datasets'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export AUDIT_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-auditBucketName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export GLUE_DB=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-athenaDBName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export GLUE_TABLE=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-athenaTableName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export ATHENA_WORKGROUP_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-athenaWorkgroupName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export AUDIT_LOG_GROUP=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-auditLogName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export TRAIL_LOG_GROUP=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-trailLogName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export FIREHOSE_STREAM_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-firehoseName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
# Test-required ENV
export IDENTITY_STORE_ID=dummyId
export IDENTITY_STORE_REGION=us-east-1
unset ADMIN_ROLE_ARN
