/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { QueryExecutionState } from '@aws-sdk/client-athena';
import { ulid } from 'ulid';
import { createAuditJob } from '../../persistence/audit-job';
import { AuditType } from '../../persistence/schema/dea-schema';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';

export const startAudit = async (
  auditType: AuditType,
  resourceId: string,
  modelProvider: ModelRepositoryProvider
) => {
  return await createAuditJob(ulid(), auditType, resourceId, modelProvider);
};

export function getQueryResponseWithState(state: QueryExecutionState) {
  return {
    $metadata: {},
    QueryExecution: {
      Status: {
        State: state,
      },
      ResultConfiguration: {
        OutputLocation: 's3://test-bucket/test-folder/',
      },
    },
  };
}
