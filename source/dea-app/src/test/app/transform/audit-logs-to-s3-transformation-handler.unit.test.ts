/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FirehoseTransformationEvent } from 'aws-lambda';
import { transformAuditEventForS3 } from '../../../app/transform/audit-logs-to-s3-transformation-handler';
import { dummyContext } from '../../integration-objects';

// Below for the data field in the test object you'll see a base64 string.
// to create these:
// create a file with your json contents
// gzip the file : `gzip somefile`
// encode the zipped file: `openssl base64 -in somefile.gz`

describe('audit logs event transformation', () => {
  it('skips control messages', async () => {
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: `H4sICBOg0mQAA2JvZ3VzAKtWyk0tLk5MTw2pLEhVslJQcvb3Cwny94n3dQ0OdnR3
                VaoFAAJTN2AiAAAA`,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('Dropped');
    expect(result.records[0].data).toEqual('');
  });

  it('transforms log events', async () => {
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: `H4sICG6v0mQAA2JvZ3VzAMWRsW7CMBCGd54i8sxghxKgWyQCU6dka1Bk6DVYiu3I
                doJQlHev7UAg7cRUT3f6v7v779zNAvsQB61pCdm1BvQeoG2cxcVHkqbxPkHzAZEX
                AcqJJFy8LaPVeoNJeBcrWe6VbGqn27goXVIIyuGJSI0Cyu+I9tmE0c1RnxSrDZNi
                xyoDSlv604t/gOLbE0MDjxweo5IWhJkWd2PkIfbljODnZV6Ibo7HbobZCxrK3QHI
                kmCCNyFeYxL94m53dqO7HLW0aiC3SY605GDOTJQ56tFY08//1/7qZfvh1P/wL7P+
                B3Mw5vpnAgAA`,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const expectedData = Buffer.from('{"value": "something"}\n{"value": "something2"}\n', 'utf-8').toString(
      'base64'
    );

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('Ok');
    expect(result.records[0].data).toEqual(expectedData);
  });

  it('notifies of failure on unknown event', async () => {
    const transformationEvent: FirehoseTransformationEvent = {
      invocationId: 'invocationId',
      deliveryStreamArn: 'deliveryStreamArn',
      region: 'region',
      records: [
        {
          recordId: 'recordId',
          data: `H4sICLCx0mQAA2JvZ3VzAKtWyk0tLk5MTw2pLEhVslJQcvJ3Dw2O93UNDnZ0d1Wq
                BQCkJcgZIAAAAA==`,
          approximateArrivalTimestamp: 123456789,
        },
      ],
    };

    const result = await transformAuditEventForS3(transformationEvent, dummyContext);
    expect(result.records.length).toEqual(1);
    expect(result.records[0].recordId).toEqual('recordId');
    expect(result.records[0].result).toEqual('ProcessingFailed');
    expect(result.records[0].data).toEqual('');
  });
});
