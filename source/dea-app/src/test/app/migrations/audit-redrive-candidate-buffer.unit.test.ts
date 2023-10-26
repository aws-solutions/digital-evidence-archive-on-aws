/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import { _Record } from '@aws-sdk/client-firehose';
import { mockClient } from 'aws-sdk-client-mock';
import AuditRedriveCandidateBuffer, {
  AuditLogEvent,
} from '../../../app/migrations/audit-redrive-candidate-buffer';

describe('flushes when the buffer limit is reached', () => {
  it('should inject the hash when an eventID is missing', async () => {
    const athenaMock = mockClient(AthenaClient);

    athenaMock
      .on(StartQueryExecutionCommand)
      .resolvesOnce({
        QueryExecutionId: 'audit-query-execution-id',
      })
      .on(GetQueryExecutionCommand)
      .resolvesOnce({
        QueryExecution: {
          Status: {
            State: QueryExecutionState.SUCCEEDED,
          },
        },
      })
      .on(GetQueryResultsCommand)
      .resolvesOnce({
        ResultSet: {
          Rows: [],
        },
        NextToken: undefined,
      });

    const recordsForRedrive: _Record[] = [];
    const auditRedriveCandidateBuffer = new AuditRedriveCandidateBuffer(
      recordsForRedrive,
      new AthenaClient(),
      '',
      '',
      '',
      '',
      '',
      false,
      3
    );

    await auditRedriveCandidateBuffer.push({
      id: 'id1',
      message: '{"something":"somevalue1"}',
    });
    expect(auditRedriveCandidateBuffer.candidateLogEvents.length).toEqual(1);

    await auditRedriveCandidateBuffer.push({
      id: 'id2',
      message: '{"something":"somevalue2"}',
    });
    expect(auditRedriveCandidateBuffer.candidateLogEvents.length).toEqual(2);

    await auditRedriveCandidateBuffer.push({
      id: 'id3',
      message: '{"something":"somevalue3"}',
    });

    expect(auditRedriveCandidateBuffer.candidateLogEvents.length).toEqual(0);
  });

  it('should inject the hash when an eventID is missing', async () => {
    const recordsForRedrive: _Record[] = [];
    const auditRedriveCandidateBuffer = new AuditRedriveCandidateBuffer(
      recordsForRedrive,
      new AthenaClient(),
      '',
      '',
      '',
      '',
      ''
    );
    await auditRedriveCandidateBuffer.push({
      id: 'id',
      message: '{"something":"somevalue"}',
    });

    expect(auditRedriveCandidateBuffer.candidateLogEvents.length).toEqual(1);
    const event: AuditLogEvent = JSON.parse(
      auditRedriveCandidateBuffer.candidateLogEvents[0].logEvent.message
    );
    expect(event.eventID).toBeDefined();
    expect(event.eventID).toEqual('o0UMj48CphuqbjIhqirFQx4g282hDfbxGmvftrTuyMI=');
  });
});
