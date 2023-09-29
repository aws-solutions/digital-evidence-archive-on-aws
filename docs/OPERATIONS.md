## Operational Monitoring

When DEA is deployed via CDK, a Nested Stack will be deployed with the identifier `DeaApiOpsDashboard`. This nested stack includes Dashboards and Alarms that we believe are valuable in monitoring the health and normal operation of your Digital Evidence Archive instance. As we expect 0 failures in the Audit System we trigger certain alarms on any single failure. Here is some additional information on some specific alarms:  
* AuditTransformMalformedAlarm    
  - This Alarm will trigger when any malformed Audit Event is encountered over the period of a day. To triage, look for the "Malformed Event" text present in `auditprocessinglambda` cloudwatch logs. The log message will include the unique ID of the event in question, which can be viewed by using the log insights filter: `filter eventID = 'your-id-here'` searching against the `deaAuditLogs` and `deaTrailLogs` CloudWatch Log Groups.  
* AuditObjectLockLambdaFailuresAlarm  
  - This Alarm will trigger when DEA fails to place a Legal Hold on any Audit Event over the period of a day, due to execution failure. To triage, view the `auditobjectlocker` logs during the time period where the Alarm was triggered. Legal hold can be set on any object via the S3 Console.
* AuditLegalHoldDLQAlarm  
  - This Alarm will trigger if the Legal Hold Dead Letter Queue has any pending messages. Triage by investigating any messages in the SQS Queue: `auditobjectlockdlq`  
* AuditKinesisFailureAlarm  
  - This Alarm will trigger if DEA fails to put records into the Audit Kinesis Firehose after a number of retries. Review the `auditprocessinglambda` CloudWatch logs during the period where the alarm was triggered.  
* AuditTransformLambdaFailuresAlarm  
  - This Alarm will trigger if the Audit Transformation lambda encounters any error that unexpectedly ends execution. Review the `auditprocessinglambda` CloudWatch logs during the period where the alarm was triggered.  
* Additional alarms are included for standard operational metrics for the DynamoDB table as well as API lambdas

## Audit Migration & Event Redrive  
An administrative script is provided for Audit Event Redrive. This script is provided for two use cases:
> :information_source: The DEA Deployment includes a Managed Policy to support the execution of the Audit Redrive script. This Policy should be attached to the Role that you intend to run the Audit Redrive with, and the Role should be individually identifiable for the purposes of Audit. To attach the Policy, search for "AuditRedrivePolicy" within the `IAM > Policies` AWS Console, or reference the target Role name and Policy ARN with the `attach-role-policy` AWS CLI command.   
e.g. `aws iam attach-role-policy --role-name example-role --policy-arn "arn:aws:iam::aws:policy/ExamplePolicy"`
1. Audit Event Migration  
If you deployed Digital Evidence Archive into production prior to release v1.0.5 your system will include Audit events that need to be migrated into the new Audit infrastructure. To do so, run the `audit-redrive` npm task from the `dea-main` package. For `startTimeMilliseconds` provide 0, and for `endTimeMilliseconds` provide a Javascript Timestamp (13 digits) equal to the time when you finished the v1.0.5 deploy. The end time doesn't need to be precise, and can overlap into the deployment as the script will check for the event before redriving. By default the script will run in `dryRun` mode, this will output information about what the script will do, without actually pushing events through Kinesis. When you are ready to push events, run with the `dryRun=false` parameter.
> e.g `npm run audit-redrive -- --startTimeMilliseconds=0 --endTimeMilliseconds=1696005186940 --dryRun=false`
---
2. Audit Event Redrive  
While it is not anticipated that Audit events fail to be duplicated from CloudWatch to S3, in the event of service outages or errors, the Audit Redrive Script can be used to correct any missing events. All Audit Events include an `eventID` which matches 1-to-1 between S3 and CloudWatch logs. To triage any events that are determined to be missing first identify the missing events in both the `deaTrailLogs` and `deaAuditLogs` CloudWatch Log Groups. This can be done through CloudWatch Insights queries. Once identified find the earliest and latest `timestamp` values among the batch of events. Run the audit-redrive task, specifying the earliest timestamp for `startTimeMilliseconds` and the latest timestamp + 1 for `endTimeMilliseconds` (+1 as end time is not inclusive). Initially run the script with dryRun=true to confirm the actions that will be taken. Once prepared to push events run the task again with dryRun=false
> e.g. `npm run audit-redrive -- --startTimeMilliseconds=1696005186939 --endTimeMilliseconds=1696005186940 --dryRun=false`
---
