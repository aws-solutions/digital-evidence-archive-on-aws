/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ObjectChecksumJob } from '../models/object-checksum-job';
import { checksumJobFromEntity } from '../models/projections';
import { ObjectChecksumJobModelRepositoryProvider } from './schema/entities';

export const upsertObjectChecksumJob = async (
  objectChecksumJob: ObjectChecksumJob,
  repositoryProvider: ObjectChecksumJobModelRepositoryProvider
): Promise<ObjectChecksumJob> => {
  const newEntity = await repositoryProvider.ObjectChecksumJobModel.upsert(
    {
      parentUlid: objectChecksumJob.parentUlid,
      fileUlid: objectChecksumJob.fileUlid,
      serializedHasher: objectChecksumJob.serializedHasher,
    },
    {
      exists: null,
    }
  );

  return checksumJobFromEntity(newEntity);
};

export const deleteObjectChecksumJob = async (
  parentUlid: string,
  fileUlid: string,
  repositoryProvider: ObjectChecksumJobModelRepositoryProvider
): Promise<void> => {
  await repositoryProvider.ObjectChecksumJobModel.remove({
    PK: `CHECKSUMJOB#${parentUlid}#${fileUlid}#`,
    SK: `CHECKSUMJOB#`,
  });
};

export const getObjectChecksumJob = async (
  parentUlid: string,
  fileUlid: string,
  repositoryProvider: ObjectChecksumJobModelRepositoryProvider
): Promise<ObjectChecksumJob | undefined> => {
  const jobEntity = await repositoryProvider.ObjectChecksumJobModel.get({
    PK: `CHECKSUMJOB#${parentUlid}#${fileUlid}#`,
    SK: `CHECKSUMJOB#`,
  });

  if (!jobEntity) {
    return undefined;
  }

  return checksumJobFromEntity(jobEntity);
};
