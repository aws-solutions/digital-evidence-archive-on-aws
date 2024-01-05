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
  export TRAIL_ARN=$(aws cloudtrail list-trails --region $REGION $profile_string --query 'Trails[?starts_with(Name,`'${STACKPREFIX}'`) == `true`].TrailARN | [0]' | sed -e 's/^"//' -e 's/"$//')

  # turn off the trail so we can clean up
  aws cloudtrail stop-logging --name $TRAIL_ARN --region $REGION $profile_string

  if [ "$DEATRAIL_BUCKET_NAME" != "null" ]; then
    echo "removing $DEATRAIL_BUCKET_NAME"
    aws s3api put-bucket-logging --bucket $DEATRAIL_BUCKET_NAME --bucket-logging-status '{}' $profile_string
    aws s3 rb s3://$DEATRAIL_BUCKET_NAME --force --region $REGION $profile_string || true
  fi
  if [ "$ARTIFACT_BUCKET_NAME" != "null" ]; then
    echo "removing $ARTIFACT_BUCKET_NAME"
    aws s3api put-bucket-logging --bucket $ARTIFACT_BUCKET_NAME --bucket-logging-status '{}' $profile_string
    aws s3 rb s3://$ARTIFACT_BUCKET_NAME --force --region $REGION $profile_string || true
  fi

  # turn off logging for buckets we are cleaning up
  aws s3api put-bucket-logging --bucket $DATASETS_BUCKET_NAME --bucket-logging-status '{}' $profile_string || true
  aws s3api put-bucket-logging --bucket $AUDIT_BUCKET_NAME --bucket-logging-status '{}' $profile_string || true
  aws s3api put-bucket-logging --bucket $QUERY_RESULT_BUCKET_NAME --bucket-logging-status '{}' $profile_string || true

  # delete the firehose so we don't get new audit objects while we clean up
  if [ "$FIREHOSE_STREAM_NAME" != "null" ]; then
    echo "deleting firehose $FIREHOSE_STREAM_NAME"
    aws firehose delete-delivery-stream --delivery-stream-name $FIREHOSE_STREAM_NAME --region $REGION $profile_string || true
    date
    # sleep to allow any in-progress audit items to finish
    echo "waiting to allow in-progress audit items to resolve..."
    sleep 90
  fi
  date
  python3 ../common/scripts/cleanupLockedBuckets.py
  date
  if [ "$S3ACCESSLOGS_BUCKET_NAME" != "null" ]; then
    echo "removing $S3ACCESSLOGS_BUCKET_NAME"
    aws s3 rb s3://$S3ACCESSLOGS_BUCKET_NAME --force --region $REGION $profile_string || true
  fi
else
  echo "Aborting..."
  exit 1
fi