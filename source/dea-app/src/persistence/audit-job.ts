/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { NotFoundError } from '../app/exceptions/not-found-exception';
import { AuditType } from './schema/dea-schema';
import { AuditJobModelRepositoryProvider } from './schema/entities';

export const createAuditJob = async (
  queryId: string,
  auditType: AuditType,
  resourceId: string,
  repositoryProvider: AuditJobModelRepositoryProvider
): Promise<string> => {
  const newEntity = await repositoryProvider.AuditJobModel.create({
    queryId,
    auditType,
    resourceId,
  });

  return newEntity.ulid;
};

export const getAuditJobQueryId = async (
  ulid: string,
  auditType: string,
  resourceId: string,
  repositoryProvider: AuditJobModelRepositoryProvider
): Promise<string> => {
  const sessionEntity = await repositoryProvider.AuditJobModel.get({
    PK: `AUDIT#${ulid}#`,
    SK: `${auditType}#${resourceId}#`,
  });

  if (!sessionEntity) {
    throw new NotFoundError('Audit Job not found.');
  }

  return sessionEntity.queryId;
};
