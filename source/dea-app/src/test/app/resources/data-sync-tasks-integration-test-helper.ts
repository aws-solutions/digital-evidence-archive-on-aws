/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { getDataSyncTasks } from '../../../app/resources/get-data-sync-tasks';
import { retry } from '../../../app/services/service-helpers';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';

export const callGetDataSyncTasks = async (
  repositoryProvider: ModelRepositoryProvider,
  limit = 100,
  next: string | undefined
) => {
  return await retry(async () => {
    const response = await getDataSyncTasks(
      getDummyEvent({
        queryStringParameters: {
          limit,
          next,
        },
      }),
      dummyContext,
      createTestProvidersObject({ repositoryProvider })
    );
    return response;
  });
};
