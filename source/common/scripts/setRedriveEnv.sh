#!/usr/bin/env bash

STACKPREFIX="${STAGE:-devsample}"
REGION="${AWS_REGION:-us-east-1}"

profile_string=$(if [ -n "$AWS_PROFILE" ]; then echo "--profile $AWS_PROFILE"; fi)

export FIREHOSE_STREAM_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-firehoseName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export GLUE_DB=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-athenaDBName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export GLUE_TABLE=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-athenaTableName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export ATHENA_WORKGROUP_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-athenaWorkgroupName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export AUDIT_LOG_GROUP=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-auditLogName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export TRAIL_LOG_GROUP=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-trailLogName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
