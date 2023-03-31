/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { S3BatchEvent, S3BatchResult, S3BatchResultResultCode, S3BatchEventTask, Context } from 'aws-lambda';
import { logger } from '../logger';

export const deleteCaseFileHandler = async (
  event: S3BatchEvent,
  context: Context
): Promise<S3BatchResult> => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });
  logger.debug('Context', { Data: JSON.stringify(context, null, 2) });
  const resultCode: S3BatchResultResultCode = 'Succeeded';
  const resultString = '';

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
