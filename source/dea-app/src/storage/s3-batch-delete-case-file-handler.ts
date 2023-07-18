/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Context, S3BatchEvent, S3BatchResult, S3BatchResultResult } from 'aws-lambda';
import { logger } from '../logger';
import {
  getCaseFileByUlid,
  setCaseFileStatusDeleteFailed,
  setCaseFileStatusDeleted,
} from '../persistence/case-file';
import { defaultProvider } from '../persistence/schema/entities';
import { DatasetsProvider, defaultDatasetsProvider, deleteCaseFile } from './datasets';

export interface lambdaCallBackFunction {
  (arg: string): void;
}
export const deleteCaseFileHandler = async (
  event: S3BatchEvent,
  context: Context,
  callbackFn: lambdaCallBackFunction,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
): Promise<S3BatchResult> => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  logger.debug('Context', { Data: JSON.stringify(context, null, 2) });
  logger.debug('callbackFn', { callbackFn });
  const results: S3BatchResultResult[] = [];

  for (const task of event.tasks) {
    const { s3Key, s3VersionId } = task;
    const [caseId, fileId] = s3Key.split('/');
    logger.info('Attempting to delete s3 object', { s3Key, s3VersionId, caseId, fileId });

    if (!datasetsProvider.deletionAllowed) {
      results.push({
        taskId: task.taskId,
        resultCode: 'PermanentFailure',
        resultString: 'This installation of DEA does not allow deletion',
      });
      logger.info('This installation of DEA does not allow deletion');
      continue;
    }

    if (!s3VersionId) {
      results.push({
        taskId: task.taskId,
        resultCode: 'PermanentFailure',
        resultString: `Missing Version ID for key: ${s3Key}`,
      });
      logger.info('Missing Version ID, skipping delete and marking failure', { s3Key, s3VersionId });
      continue;
    }

    const caseFile = await getCaseFileByUlid(fileId, caseId, repositoryProvider);
    if (!caseFile) {
      results.push({
        taskId: task.taskId,
        resultCode: 'PermanentFailure',
        resultString: `Could not find case file: fileId: ${fileId}, caseId: ${caseId}`,
      });
      logger.info('Could not find case file, skipping delete and marking failure');
      continue;
    }

    try {
      await deleteCaseFile(s3Key, s3VersionId, datasetsProvider);
      logger.info('Successfully deleted object', { s3Key, s3VersionId });
      await setCaseFileStatusDeleted(caseFile, repositoryProvider);
      results.push({
        taskId: task.taskId,
        resultCode: 'Succeeded',
        resultString: `Successfully deleted object: ${s3Key}`,
      });
    } catch (e) {
      logger.error(`Unexpected failure`, e);
      try {
        await setCaseFileStatusDeleteFailed(caseFile, repositoryProvider);
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
