/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { S3BatchEvent, S3BatchResult, S3BatchResultResultCode, S3BatchEventTask, Context } from 'aws-lambda';
import { logger } from '../logger';
// import { defaultProvider } from '../persistence/schema/entities';
// import { DatasetsProvider, defaultDatasetsProvider } from './datasets';

export const s3BatchJobStatusChangeHandler = async (
  event: S3BatchEvent,
  context: Context
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  // repositoryProvider = defaultProvider,
  /* istanbul ignore next */
  // datasetsProvider: DatasetsProvider = defaultDatasetsProvider
): Promise<S3BatchResult> => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  logger.debug('Context', { Data: JSON.stringify(context, null, 2) });
  const resultCode: S3BatchResultResultCode = 'Succeeded';
  const resultString = '';

  // TODO -> ensure that all case-files are marked as deleted

  if (event.tasks.length === 0) {
    throw new Error('No tasks in event');
  }

  return {
    invocationSchemaVersion: '1.0',
    treatMissingKeysAs: 'PermanentFailure',
    invocationId: event.invocationId,
    results: event.tasks.map((t: S3BatchEventTask) => ({
      taskId: t.taskId,
      resultCode: resultCode,
      resultString: resultString,
    })),
  };
};
