import boto3
import os
 
AUDIT_BUCKET = os.getenv('AUDIT_BUCKET_NAME')
DATASETS_BUCKET = os.getenv('DATASETS_BUCKET_NAME')
QUERY_RESULT_BUCKET = os.getenv('QUERY_RESULT_BUCKET_NAME')
BUCKETS = [
AUDIT_BUCKET,
DATASETS_BUCKET,
QUERY_RESULT_BUCKET
]
s3 = boto3.resource('s3')
client = boto3.client('s3')
for BUCKET in BUCKETS:
    print('Cleaning up verioned/locked bucket: {}'.format(BUCKET))
    bucket = s3.Bucket(BUCKET)
    try:
        for obj in bucket.objects.all():
            try:
                client.put_object_legal_hold(
                    Bucket=obj.bucket_name,
                    Key=obj.key,
                    LegalHold={
                        'Status': 'OFF'
                    },
                )
            except Exception as someError:
                # this will fail if the object is not locked
                pass
        for obj in bucket.object_versions.all():
            try:
                client.put_object_legal_hold(
                    Bucket=obj.bucket_name,
                    Key=obj.object_key,
                    VersionId=obj.id,
                    LegalHold={
                        'Status': 'OFF'
                    },
                )
            except Exception as verError:
                # this will fail if the object is not locked
                pass
        try:
            bucket.object_versions.delete()
            print('{} versions deleted'.format(bucket))
        except Exception as verDel:
            print('{} version delete failed {}'.format(bucket, verDel))
        try:
            bucket.objects.delete()
            print('{} objects deleted'.format(bucket))
        except Exception as objDel:
            print('{} object delete failed {}'.format(bucket, objDel))
        
    except Exception as skipErr:
        print('{} skipped because {}'.format(bucket, skipErr))
        pass
