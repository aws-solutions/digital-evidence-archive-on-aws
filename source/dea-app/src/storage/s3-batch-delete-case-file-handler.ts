/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Context, S3BatchEvent, S3BatchResult, S3BatchResultResult } from 'aws-lambda';
import { logger } from '../logger';
import { CaseFileStatus } from '../models/case-file-status';
import { updateCaseFileStatus } from '../persistence/case-file';
import { defaultProvider } from '../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider, deleteCaseFile } from './datasets';

export const deleteCaseFileHandler = async (
  event: S3BatchEvent,
  context: Context,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
): Promise<S3BatchResult> => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  logger.debug('Context', { Data: JSON.stringify(context, null, 2) });
  const results: S3BatchResultResult[] = [];
  if (event.tasks.length === 0) {
    throw new Error('No tasks in event');
  }

  for (const task of event.tasks) {
    const { s3Key, s3VersionId } = task;
    const [caseId, fileId] = s3Key.split('/');
    logger.info('Attempting to delete s3 object', { s3Key, s3VersionId });
    if (!s3VersionId) {
      results.push({
        taskId: task.taskId,
        resultCode: 'PermanentFailure',
        resultString: `Missing Version ID for key: ${s3Key}`,
      });
      logger.info('Missing Version ID, skipping delete and marking failure', { s3Key, s3VersionId });
      continue;
    }
    try {
      await deleteCaseFile(s3Key, s3VersionId, datasetsProvider);
      await updateCaseFileStatus(caseId, fileId, CaseFileStatus.DELETED, repositoryProvider);
      results.push({
        taskId: task.taskId,
        resultCode: 'Succeeded',
        resultString: `Successfully deleted object: ${s3Key}`,
      });
    } catch (e) {
      logger.error(`Failed to delete S3 object: ${s3Key}`, e);
      try {
        await updateCaseFileStatus(caseId, fileId, CaseFileStatus.DELETE_FAILED, repositoryProvider);
      } catch (e) {
        logger.error(`Failed to update DDB: ${s3Key}`, e);
      }
      results.push({
        taskId: task.taskId,
        resultCode: 'TemporaryFailure',
        resultString: `Failed to delete object: ${s3Key}`,
      });
    }
  }

  return {
    invocationSchemaVersion: '1.0',
    treatMissingKeysAs: 'PermanentFailure',
    invocationId: event.invocationId,
    results,
  };
};
