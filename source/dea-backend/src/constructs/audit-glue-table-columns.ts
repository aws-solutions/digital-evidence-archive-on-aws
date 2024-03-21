/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as glue from '@aws-cdk/aws-glue-alpha';

const dynamoKeySchema = {
  name: 'key',
  type: glue.Schema.struct([
    {
      name: 'PK',
      type: glue.Schema.STRING,
    },
    {
      name: 'SK',
      type: glue.Schema.STRING,
    },
    {
      name: 'GSI1PK',
      type: glue.Schema.STRING,
    },
    {
      name: 'GSI1SK',
      type: glue.Schema.STRING,
    },
    {
      name: 'GSI2PK',
      type: glue.Schema.STRING,
    },
    {
      name: 'GSI2SK',
      type: glue.Schema.STRING,
    },
  ]),
};

export const auditGlueTableColumns = [
  {
    name: 'timestamp',
    type: glue.Schema.TIMESTAMP,
  },
  {
    name: 'logEventType',
    type: glue.Schema.STRING,
  },
  {
    name: 'userIdentity',
    type: glue.Schema.struct([
      {
        name: 'type',
        type: glue.Schema.STRING,
      },
      {
        name: 'userName',
        type: glue.Schema.STRING,
      },
      {
        name: 'sessionContext',
        type: glue.Schema.struct([
          {
            name: 'sessionIssuer',
            type: glue.Schema.struct([
              {
                name: 'userName',
                type: glue.Schema.STRING,
              },
            ]),
          },
        ]),
      },
    ]),
  },
  {
    name: 'actorIdentity',
    type: glue.Schema.struct([
      {
        name: 'idType',
        type: glue.Schema.STRING,
      },
      {
        name: 'sourceIp',
        type: glue.Schema.STRING,
      },
      {
        name: 'idPoolUserId',
        type: glue.Schema.STRING,
      },
      {
        name: 'username',
        type: glue.Schema.STRING,
      },
      {
        name: 'firstName',
        type: glue.Schema.STRING,
      },
      {
        name: 'lastName',
        type: glue.Schema.STRING,
      },
      {
        name: 'userUlid',
        type: glue.Schema.STRING,
      },
      {
        name: 'deaRole',
        type: glue.Schema.STRING,
      },
      {
        name: 'groupMemberships',
        type: glue.Schema.STRING,
      },
      {
        name: 'userPoolUserId',
        type: glue.Schema.STRING,
      },
      {
        name: 'authCode',
        type: glue.Schema.STRING,
      },
      {
        name: 'idToken',
        type: glue.Schema.STRING,
      },
    ]),
  },
  {
    // this is a datetime string, e.g. "2023-08-11T16:42:26Z"
    name: 'dateTime',
    type: glue.Schema.STRING,
  },
  {
    // this is a datetime string, e.g. "2023-08-11T16:42:26Z"
    name: 'eventTime',
    type: glue.Schema.STRING,
  },
  {
    name: 'eventType',
    type: glue.Schema.STRING,
  },
  {
    name: 'requestPath',
    type: glue.Schema.STRING,
  },
  {
    name: 'result',
    type: glue.Schema.STRING,
  },
  {
    name: 'eventName',
    type: glue.Schema.STRING,
  },
  {
    name: 'sourceComponent',
    type: glue.Schema.STRING,
  },
  {
    name: 'eventSource',
    type: glue.Schema.STRING,
  },
  {
    name: 'sourceIPAddress',
    type: glue.Schema.STRING,
  },
  {
    name: 'caseId',
    type: glue.Schema.STRING,
  },
  {
    name: 'dataVaultId',
    type: glue.Schema.STRING,
  },
  {
    name: 'fileId',
    type: glue.Schema.STRING,
  },
  {
    name: 'fileHash',
    type: glue.Schema.STRING,
  },
  {
    name: 'caseActions',
    type: glue.Schema.STRING,
  },
  {
    name: 'targetUserId',
    type: glue.Schema.STRING,
  },
  {
    name: 'downloadReason',
    type: glue.Schema.STRING,
  },
  {
    name: 'eventID',
    type: glue.Schema.STRING,
  },
  {
    name: 'requestParameters',
    type: glue.Schema.struct([
      dynamoKeySchema,
      {
        name: 'requestItems',
        type: glue.Schema.array(glue.Schema.struct([dynamoKeySchema])),
      },
    ]),
  },
  {
    name: 'resources',
    type: glue.Schema.struct([
      {
        name: '0',
        type: glue.Schema.struct([
          {
            name: 'ARN',
            type: glue.Schema.STRING,
          },
        ]),
      },
    ]),
  },
];
