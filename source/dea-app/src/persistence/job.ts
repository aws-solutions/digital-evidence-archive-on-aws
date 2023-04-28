/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Job, JobInput } from '../models/job';
import { jobFromEntity } from '../models/projections';
import { JobModelRepositoryProvider } from './schema/entities';

export const createJob = async (
  job: JobInput,
  repositoryProvider: JobModelRepositoryProvider
): Promise<Job> => {
  const newEntity = await repositoryProvider.JobModel.create({
    ...job,
  });

  return jobFromEntity(newEntity);
};

export const deleteJob = async (
  jobId: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: JobModelRepositoryProvider
): Promise<void> => {
  await repositoryProvider.JobModel.remove({
    PK: `JOB#${jobId}#`,
    SK: `JOB#`,
  });
};

export const getJob = async (
  jobId: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: JobModelRepositoryProvider
): Promise<Job | undefined> => {
  const jobEntity = await repositoryProvider.JobModel.get({
    PK: `JOB#${jobId}#`,
    SK: `JOB#`,
  });

  if (!jobEntity) {
    return undefined;
  }

  return jobFromEntity(jobEntity);
};
