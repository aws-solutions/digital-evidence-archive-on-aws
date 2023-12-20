#!/usr/bin/env bash

read -p "This process will attempt to clean up all Digital Evidence Archive S3 Buckets, including those with Audit and CaseFile data. Are you sure want to proceed? (Enter 'Proceed with cleanup' to continue) " -n 20 -r
echo
if [[ $REPLY = 'Proceed with cleanup' ]]
then

STACKPREFIX="${STAGE:-devsample}"
REGION="${AWS_REGION:-us-east-1}"

profile_string=$(if [ -n "$AWS_PROFILE" ]; then echo "--profile $AWS_PROFILE"; fi)

export DATASETS_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-DeaS3Datasets'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export S3ACCESSLOGS_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-S3AccessLogsBucketName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export DEATRAIL_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-deaTrailBucketName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export AUDIT_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-auditBucketName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export QUERY_RESULT_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-queryResultBucketName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export ARTIFACT_BUCKET_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-artifactBucketName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export OBJECT_LOCK_QUEUE_URL=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-objectLockQueueUrl'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')
export FIREHOSE_STREAM_NAME=$(aws cloudformation list-exports --region $REGION $profile_string --query """Exports[?Name == '${STACKPREFIX}-firehoseName'].Value | [0]""" | sed -e 's/^"//' -e 's/"$//')

echo "removing $DEATRAIL_BUCKET_NAME"
aws s3 rb s3://$DEATRAIL_BUCKET_NAME --force --region $REGION $profile_string
echo "removing $ARTIFACT_BUCKET_NAME"
aws s3 rb s3://$ARTIFACT_BUCKET_NAME --force --region $REGION $profile_string

# delete the firehose so we don't get new audit objects while we clean up
echo "deleting firehose $FIREHOSE_STREAM_NAME"
aws firehose delete-delivery-stream --delivery-stream-name $FIREHOSE_STREAM_NAME --region $REGION $profile_string
date
# sleep to allow any in-progress audit items to finish
echo "waiting to allow in-progress audit items to resolve..."
sleep 90
date
python3 ../common/scripts/cleanupLockedBuckets.py
date
echo "removing $S3ACCESSLOGS_BUCKET_NAME"
aws s3 rb s3://$S3ACCESSLOGS_BUCKET_NAME --force --region $REGION $profile_string
else
  echo "Aborting..."
  exit 1
fi