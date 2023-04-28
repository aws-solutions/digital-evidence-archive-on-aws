/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { joiUlid } from '../../models/validation/joi-common';
import * as sut from '../../persistence/audit-job';
import { AuditType } from '../../persistence/schema/dea-schema';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { getTestRepositoryProvider } from './local-db-table';

describe('audit job persistence', () => {
  let modelProvider: ModelRepositoryProvider;
  beforeAll(async () => {
    modelProvider = await getTestRepositoryProvider('auditJobTestTable');
  });

  afterAll(async () => {
    await modelProvider.table.deleteTable('DeleteTableForever');
  });

  it('should create a job record and return the ulid', async () => {
    const queryId = 'bogusquery';
    const resourceId = 'someResourceId';
    const jobUlid = await sut.createAuditJob(queryId, AuditType.CASE, resourceId, modelProvider);
    expect(jobUlid).toBeDefined();
    Joi.assert(jobUlid, joiUlid);
  });

  it('should retrieve a query id for an existing audit job', async () => {
    const queryId = 'bogusquery';
    const resourceId = 'someResourceId';
    const jobUlid = await sut.createAuditJob(queryId, AuditType.CASE, resourceId, modelProvider);
    expect(jobUlid).toBeDefined();
    Joi.assert(jobUlid, joiUlid);

    const queryIdResponse = await sut.getAuditJobQueryId(jobUlid, AuditType.CASE, resourceId, modelProvider);
    expect(queryIdResponse).toEqual(queryId);
  });

  it('should throw a not found error when the requested job does not exist', async () => {
    const queryId = 'bogusquery';
    const resourceId = 'someResourceId';
    const jobUlid = await sut.createAuditJob(queryId, AuditType.CASE, resourceId, modelProvider);
    expect(jobUlid).toBeDefined();
    Joi.assert(jobUlid, joiUlid);

    await expect(sut.getAuditJobQueryId(jobUlid, AuditType.USER, resourceId, modelProvider)).rejects.toThrow(
      'Audit Job not found.'
    );
  });
});
