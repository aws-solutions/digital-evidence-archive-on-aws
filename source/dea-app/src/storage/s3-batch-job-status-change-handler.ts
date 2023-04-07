/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DescribeJobResult } from '@aws-sdk/client-s3-control';
import { Context, EventBridgeEvent } from 'aws-lambda';
import { logger } from '../logger';
import { DeaCase } from '../models/case';
import { CaseFileStatus } from '../models/case-file-status';
import { CaseStatus } from '../models/case-status';
import { getCase, updateCasePostJobCompletion } from '../persistence/case';
import { deleteJob, getJob } from '../persistence/job';
import { defaultProvider, ModelRepositoryProvider } from '../persistence/schema/entities';
import { describeS3BatchJob } from './datasets';

export interface S3BatchEventBridgeDetail {
  serviceEventDetails: ServiceEventDetails;
}

export interface ServiceEventDetails {
  jobId: string;
  jobArn: string;
  status: string;
  jobEventId: string;
  failureCodes: string;
  statusChangeReason: [];
}

export const s3BatchJobStatusChangeHandler = async (
  event: EventBridgeEvent<string, S3BatchEventBridgeDetail>,
  context: Context,
  //eslint-disable-next-line @typescript-eslint/no-empty-function
  callbackFn = () => {},
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<void> => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  logger.debug('Context', { Data: JSON.stringify(context, null, 2) });
  logger.debug('callbackFn', callbackFn);

  if (event.detail.serviceEventDetails.status !== 'Complete') {
    logger.info("Job status isn't complete. No actions performed.");
  }

  const jobId = event.detail.serviceEventDetails.jobId;
  const deaJob = await getJob(jobId, repositoryProvider);
  if (!deaJob) {
    logger.info("This event isn't related to DEA. Skipping..");
    return;
  }
  logger.info('Loaded job successfully', deaJob);

  const deaCase = await getCase(deaJob.caseUlid, undefined, repositoryProvider);
  if (!deaCase) {
    logger.error('Could not load case for job', deaJob);
    return;
  }
  logger.info('Loaded case successfully', deaCase);

  const awsAccountId = context.invokedFunctionArn.split(':')[4];
  const s3BatchJob = await describeS3BatchJob(jobId, awsAccountId);
  logger.debug('S3batch job', s3BatchJob);

  if (deaCase.status === CaseStatus.INACTIVE && deaCase.filesStatus === CaseFileStatus.DELETING) {
    if (s3BatchJobSucceeded(s3BatchJob)) {
      logger.info('Job succeeded, marking complete');
      await updateCaseAndDeleteJob(deaCase, jobId, CaseFileStatus.DELETED, repositoryProvider);
    } else {
      logger.info('Job failed, marking as failed');
      await updateCaseAndDeleteJob(deaCase, jobId, CaseFileStatus.DELETE_FAILED, repositoryProvider);
    }
    return;
  }

  logger.info('No actions performed. Exiting');
};

async function updateCaseAndDeleteJob(
  deaCase: DeaCase,
  jobId: string,
  filesStatus: CaseFileStatus,
  repositoryProvider: ModelRepositoryProvider
) {
  await updateCasePostJobCompletion(deaCase, filesStatus, repositoryProvider);
  logger.info('Updated case successfully');
  await deleteJob(jobId, repositoryProvider);
  logger.info('Deleted job successfully');
}

function s3BatchJobSucceeded(s3BatchJob: DescribeJobResult): boolean {
  if (
    s3BatchJob.Job &&
    s3BatchJob.Job.ProgressSummary &&
    s3BatchJob.Job.ProgressSummary.NumberOfTasksFailed === 0
  ) {
    return true;
  }
  return false;
}
