/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import 'aws-sdk-client-mock-jest';
import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { Firehose, PutRecordBatchCommand } from '@aws-sdk/client-firehose';
import { AwsClientStub, mockClient } from 'aws-sdk-client-mock';
import { auditRedrive } from '../../../app/migrations/audit-redrive';

describe('audit-redrive', () => {
  let firehoseClientMock: AwsClientStub<Firehose>;
  beforeAll(() => {
    firehoseClientMock = mockClient(Firehose);
  });

  beforeEach(() => {
    firehoseClientMock.reset();
    firehoseClientMock.on(PutRecordBatchCommand).resolves({});
  });

  it('pushes missing events to kinesis', async () => {
    mockValidEventsMissingFromAthena();

    await auditRedrive(0, 1, false);

    expect(firehoseClientMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 1);
  });

  it('skips kinesis in a dry run', async () => {
    mockValidEventsMissingFromAthena();

    await auditRedrive(0, 1, true);

    expect(firehoseClientMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 0);
  });

  it('uses a hash when an event has no id', async () => {
    mockValidEventWithNoEventID();

    await auditRedrive(0, 1, false);

    expect(firehoseClientMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 1);
  });

  it('matches an existing hash when a present event has no id', async () => {
    mockPresentEventWithNoEventID();

    await auditRedrive(0, 1, false);

    expect(firehoseClientMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 0);
  });

  it('filters cloudtrail events with no identifying info', async () => {
    mockTrailEventWithNoIdentity();

    await auditRedrive(0, 1, false);

    expect(firehoseClientMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 0);
  });

  it('skips events that are already present in athena', async () => {
    mockValidEventsPresentInAthena();

    await auditRedrive(0, 1, false);

    expect(firehoseClientMock).toHaveReceivedCommandTimes(PutRecordBatchCommand, 0);
  });

  it('excepts on athena startyquery failures', async () => {
    mockForAthenaStartQueryException();

    await expect(auditRedrive(0, 1, false)).rejects.toThrow('Unknown error starting Athena Query.');
  });

  it('excepts on athena query failures', async () => {
    mockForAthenaQueryFailure();

    await expect(auditRedrive(0, 1, false)).rejects.toThrow('Athena query failed to execute. FAILED: busted');
  });
});

function mockValidEventsMissingFromAthena() {
  const cloudwatchLogsMockClient = mockClient(CloudWatchLogsClient);
  const athenaMock = mockClient(AthenaClient);

  cloudwatchLogsMockClient
    .on(DescribeLogStreamsCommand)
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'auditTestStreamOne',
        },
      ],
      nextToken: 'more',
    })
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'auditTestStreamTwo',
        },
      ],
      nextToken: undefined,
    })
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'trailTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .on(GetLogEventsCommand)
    .resolvesOnce({
      // This operation can return empty results while there are more log events available through the token.
      events: undefined,
      nextForwardToken: 'more',
    })
    .resolvesOnce({
      // valid audit event
      events: [
        {
          message: JSON.stringify({
            eventID: 'event-id-one',
          }),
        },
      ],
      // If you have reached the end of the stream, it returns the same token you passed in.
      nextForwardToken: 'more',
    })
    .resolvesOnce({
      events: undefined,
      nextForwardToken: undefined,
    })
    .resolvesOnce({
      events: [
        // valid trail event
        {
          message: JSON.stringify({
            eventID: 'event-id-two',
            userIdentity: { userName: 'trailCallerOne' },
          }),
        },
        // valid trail event
        {
          message: JSON.stringify({
            eventID: 'event-id-three',
            userIdentity: {
              sessionContext: {
                sessionIssuer: {
                  userName: 'trailCallerTwo',
                },
              },
            },
          }),
        },
      ],
      nextForwardToken: undefined,
    });

  athenaMock
    .on(StartQueryExecutionCommand)
    .resolvesOnce({
      QueryExecutionId: 'audit-query-execution-id',
    })
    .resolvesOnce({
      QueryExecutionId: 'trail-query-execution-id',
    })
    .on(GetQueryExecutionCommand)
    .resolvesOnce({
      QueryExecution: {
        Status: {
          State: QueryExecutionState.RUNNING,
        },
      },
    })
    .resolvesOnce({
      QueryExecution: {
        Status: {
          State: QueryExecutionState.SUCCEEDED,
        },
      },
    })
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
    })
    .resolvesOnce({
      ResultSet: {
        Rows: [],
      },
      NextToken: undefined,
    });
}

function mockValidEventWithNoEventID() {
  const cloudwatchLogsMockClient = mockClient(CloudWatchLogsClient);
  const athenaMock = mockClient(AthenaClient);

  cloudwatchLogsMockClient
    .on(DescribeLogStreamsCommand)
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'auditTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'trailTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .on(GetLogEventsCommand)
    .resolvesOnce({
      // valid audit event
      events: [
        {
          message: JSON.stringify({
            something: '1',
            somethingElse: '2',
          }),
        },
      ],
      nextForwardToken: undefined,
    })
    .resolvesOnce({
      events: [],
      nextForwardToken: undefined,
    });

  athenaMock
    .on(StartQueryExecutionCommand)
    .resolvesOnce({
      QueryExecutionId: 'query-execution-id',
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
}

function mockPresentEventWithNoEventID() {
  const cloudwatchLogsMockClient = mockClient(CloudWatchLogsClient);
  const athenaMock = mockClient(AthenaClient);

  cloudwatchLogsMockClient
    .on(DescribeLogStreamsCommand)
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'auditTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'trailTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .on(GetLogEventsCommand)
    .resolvesOnce({
      // valid audit event
      events: [
        {
          message: JSON.stringify({
            something: '1',
            somethingElse: '2',
          }),
        },
      ],
      nextForwardToken: undefined,
    })
    .resolvesOnce({
      events: [],
      nextForwardToken: undefined,
    });

  athenaMock
    .on(StartQueryExecutionCommand)
    .resolvesOnce({
      QueryExecutionId: 'query-execution-id',
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
        Rows: [
          {
            Data: [
              {
                VarCharValue: 'zdZyjsDQ7alfZj5tUlVsewRGktVC6JFDh132iLJu3o4=',
              },
            ],
          },
        ],
      },
      NextToken: undefined,
    });
}

function mockTrailEventWithNoIdentity() {
  const cloudwatchLogsMockClient = mockClient(CloudWatchLogsClient);
  const athenaMock = mockClient(AthenaClient);

  cloudwatchLogsMockClient
    .on(DescribeLogStreamsCommand)
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'auditTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'trailTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .on(GetLogEventsCommand)
    .resolvesOnce({
      events: [],
      nextForwardToken: undefined,
    })
    .resolvesOnce({
      events: [
        {
          message: JSON.stringify({
            eventID: 'event-id-two',
            userIdentity: {},
          }),
        },
        {
          message: JSON.stringify({
            eventID: 'event-id-three',
            userIdentity: {
              sessionContext: {},
            },
          }),
        },
      ],
      nextForwardToken: undefined,
    });

  athenaMock
    .on(StartQueryExecutionCommand)
    .resolvesOnce({
      QueryExecutionId: 'query-execution-id',
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
}

function mockValidEventsPresentInAthena() {
  const cloudwatchLogsMockClient = mockClient(CloudWatchLogsClient);
  const athenaMock = mockClient(AthenaClient);

  cloudwatchLogsMockClient
    .on(DescribeLogStreamsCommand)
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'auditTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'trailTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .on(GetLogEventsCommand)
    .resolvesOnce({
      // valid audit event
      events: [
        {
          message: JSON.stringify({
            eventID: 'event-id-one',
          }),
        },
      ],
      nextForwardToken: undefined,
    })
    .resolvesOnce({
      events: [
        // valid trail event
        {
          message: JSON.stringify({
            eventID: 'event-id-two',
            userIdentity: { userName: 'trailCallerOne' },
          }),
        },
        // valid trail event
        {
          message: JSON.stringify({
            eventID: 'event-id-three',
            userIdentity: {
              sessionContext: {
                sessionIssuer: {
                  userName: 'trailCallerTwo',
                },
              },
            },
          }),
        },
      ],
      nextForwardToken: undefined,
    });

  athenaMock
    .on(StartQueryExecutionCommand)
    .resolvesOnce({
      QueryExecutionId: 'audit-query-execution-id',
    })
    .resolvesOnce({
      QueryExecutionId: 'trail-query-execution-id',
    })
    .on(GetQueryExecutionCommand)
    .resolvesOnce({
      QueryExecution: {
        Status: {
          State: QueryExecutionState.SUCCEEDED,
        },
      },
    })
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
        Rows: [
          {
            Data: [
              {
                VarCharValue: 'other-id-one',
              },
            ],
          },
        ],
      },
      NextToken: 'morequeryresults',
    })
    .resolvesOnce({
      ResultSet: {
        Rows: [
          {
            Data: [
              {
                VarCharValue: 'event-id-one',
              },
            ],
          },
          {
            Data: [
              {
                VarCharValue: 'other-id-three',
              },
            ],
          },
        ],
      },
      NextToken: undefined,
    })
    .resolvesOnce({
      ResultSet: {
        Rows: [
          {
            Data: [
              {
                VarCharValue: 'event-id-two',
              },
            ],
          },
          {
            Data: [
              {
                VarCharValue: 'event-id-three',
              },
            ],
          },
        ],
      },
      NextToken: undefined,
    });
}

function mockForAthenaStartQueryException() {
  const cloudwatchLogsMockClient = mockClient(CloudWatchLogsClient);
  const athenaMock = mockClient(AthenaClient);

  cloudwatchLogsMockClient
    .on(DescribeLogStreamsCommand)
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'auditTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'trailTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .on(GetLogEventsCommand)
    .resolvesOnce({
      // valid audit event
      events: [
        {
          message: JSON.stringify({
            something: '1',
            somethingElse: '2',
          }),
        },
      ],
      nextForwardToken: undefined,
    })
    .resolvesOnce({
      events: [],
      nextForwardToken: undefined,
    });

  athenaMock.on(StartQueryExecutionCommand).resolvesOnce({
    QueryExecutionId: undefined,
  });
}

function mockForAthenaQueryFailure() {
  const cloudwatchLogsMockClient = mockClient(CloudWatchLogsClient);
  const athenaMock = mockClient(AthenaClient);

  cloudwatchLogsMockClient
    .on(DescribeLogStreamsCommand)
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'auditTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .resolvesOnce({
      logStreams: [
        {
          logStreamName: 'trailTestStreamOne',
        },
      ],
      nextToken: undefined,
    })
    .on(GetLogEventsCommand)
    .resolvesOnce({
      // valid audit event
      events: [
        {
          message: JSON.stringify({
            something: '1',
            somethingElse: '2',
          }),
        },
      ],
      nextForwardToken: undefined,
    })
    .resolvesOnce({
      events: [],
      nextForwardToken: undefined,
    });

  athenaMock.on(StartQueryExecutionCommand).resolvesOnce({
    QueryExecutionId: 'query-execution-id',
  });

  athenaMock.on(GetQueryExecutionCommand).resolvesOnce({
    QueryExecution: {
      Status: {
        State: QueryExecutionState.FAILED,
        StateChangeReason: 'busted',
      },
    },
  });
}
