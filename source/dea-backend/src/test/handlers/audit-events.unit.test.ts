/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { PutLogEventsCommand, PutLogEventsCommandInput } from '@aws-sdk/client-cloudwatch-logs';
import { dummyContext, getDummyEvent, getTestAuditService } from '@aws/dea-app';
import { anyOfClass, capture, verify } from 'ts-mockito';
import { createDeaHandler, NO_ACL } from '../../handlers/create-dea-handler';

describe('dea lambda audits', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_LOG_GROUP_NAME = 'TESTGROUP';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const preExecutionChecks = async () => {
    return;
  };

  it('should throw an error, not call the handler, but still send audit when event type is unknown', async () => {
    const testAuditService = getTestAuditService();
    const mockHandler = async () => {
      return {
        statusCode: 200,
        body: '{}',
      };
    };

    const sut = createDeaHandler(mockHandler, NO_ACL, preExecutionChecks, testAuditService.service);

    const theEvent = getDummyEvent();
    theEvent.resource = '/bogus';

    const response = await sut(theEvent, dummyContext);
    expect(response).toEqual({ body: 'An error occurred', statusCode: 500 });

    const sent = capture(testAuditService.client.send).last();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sentInput: PutLogEventsCommandInput = sent[0].input as unknown as PutLogEventsCommandInput;
    if (!sentInput.logEvents) {
      fail();
    }
    expect(sentInput.logEvents[0].message).toContain(`"eventType":"UnknownEvent"`);
  });

  it('should throw an error, not call the handler, but still send audit when the caller has no identity', async () => {
    const testAuditService = getTestAuditService();
    const mockHandler = async () => {
      return {
        statusCode: 200,
        body: '{}',
      };
    };

    const sut = createDeaHandler(mockHandler, NO_ACL, preExecutionChecks, testAuditService.service);

    const theEvent = getDummyEvent();
    theEvent.requestContext.identity.cognitoIdentityId = null;

    const response = await sut(theEvent, dummyContext);
    expect(response).toEqual({ body: 'Authentication information missing.', statusCode: 400 });

    const sent = capture(testAuditService.client.send).last();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sentInput: PutLogEventsCommandInput = sent[0].input as unknown as PutLogEventsCommandInput;
    if (!sentInput.logEvents) {
      fail();
    }
    expect(sentInput.logEvents[0].message).toContain(`"idType":"UnidentifiedRequestor"`);
  });

  it('should add success to the event when the callback returns a success code', async () => {
    const testAuditService = getTestAuditService();
    const sut = createDeaHandler(
      async () => {
        return {
          statusCode: 200,
          body: ':D',
        };
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const theEvent = getDummyEvent();
    theEvent.requestContext.identity.cognitoIdentityId = 'modernmajorgeneral';

    const response = await sut(theEvent, dummyContext);
    expect(response).toEqual({ body: ':D', statusCode: 200 });

    const sent = capture(testAuditService.client.send).last();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sentInput: PutLogEventsCommandInput = sent[0].input as unknown as PutLogEventsCommandInput;
    if (!sentInput.logEvents) {
      fail();
    }
    expect(sentInput.logEvents[0].message).toContain(`"result":"success"`);
  });

  it('should still send an audit when the callback throws', async () => {
    const testAuditService = getTestAuditService();
    const sut = createDeaHandler(
      async () => {
        throw new Error('D:');
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const theEvent = getDummyEvent();
    theEvent.requestContext.identity.cognitoIdentityId = 'modernmajorgeneral';

    const response = await sut(theEvent, dummyContext);
    expect(response).toEqual({ body: 'An error occurred', statusCode: 500 });

    verify(testAuditService.client.send(anyOfClass(PutLogEventsCommand))).once();
  });

  it('should send a failure event when the callback finishes with an error code', async () => {
    const testAuditService = getTestAuditService();
    const sut = createDeaHandler(
      async () => {
        return {
          statusCode: 400,
          body: ':{',
        };
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const theEvent = getDummyEvent();
    theEvent.requestContext.identity.cognitoIdentityId = 'modernmajorgeneral';

    const response = await sut(theEvent, dummyContext);
    expect(response).toEqual({ body: ':{', statusCode: 400 });

    const sent = capture(testAuditService.client.send).last();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sentInput: PutLogEventsCommandInput = sent[0].input as unknown as PutLogEventsCommandInput;
    if (!sentInput.logEvents) {
      fail();
    }
    expect(sentInput.logEvents[0].message).toContain(`"result":"failure"`);
  });

  it('should construct AUTH_CODE_REQUESTOR identity', async () => {
    const testAuditService = getTestAuditService();
    const sut = createDeaHandler(
      async () => {
        return {
          statusCode: 200,
          body: ':D',
        };
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const theEvent = getDummyEvent();
    theEvent.requestContext.identity.cognitoIdentityId = null;
    theEvent.pathParameters = {
      authCode: 'abc123',
    };

    const response = await sut(theEvent, dummyContext);
    expect(response).toEqual({ body: ':D', statusCode: 200 });

    const sent = capture(testAuditService.client.send).last();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sentInput: PutLogEventsCommandInput = sent[0].input as unknown as PutLogEventsCommandInput;
    if (!sentInput.logEvents) {
      fail();
    }
    expect(sentInput.logEvents[0].message).toContain(`"idType":"AuthCodeRequestor"`);
  });

  it('should construct ID_TOKEN_REQUESTOR identity', async () => {
    const testAuditService = getTestAuditService();
    const sut = createDeaHandler(
      async () => {
        return {
          statusCode: 200,
          body: ':D',
        };
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const theEvent = getDummyEvent();
    theEvent.requestContext.identity.cognitoIdentityId = null;
    theEvent.pathParameters = {
      idToken: 'abc123',
    };

    const response = await sut(theEvent, dummyContext);
    expect(response).toEqual({ body: ':D', statusCode: 200 });

    const sent = capture(testAuditService.client.send).last();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sentInput: PutLogEventsCommandInput = sent[0].input as unknown as PutLogEventsCommandInput;
    if (!sentInput.logEvents) {
      fail();
    }
    expect(sentInput.logEvents[0].message).toContain(`"idType":"TokenRequestor"`);
  });

  it('should construct AUTH_URL_REQUESTER identity', async () => {
    const testAuditService = getTestAuditService();
    const sut = createDeaHandler(
      async () => {
        return {
          statusCode: 200,
          body: ':D',
        };
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const theEvent = getDummyEvent();
    theEvent.requestContext.identity.cognitoIdentityId = null;
    theEvent.resource = '/auth/getLoginUrl';

    const response = await sut(theEvent, dummyContext);
    expect(response).toEqual({ body: ':D', statusCode: 200 });

    const sent = capture(testAuditService.client.send).last();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sentInput: PutLogEventsCommandInput = sent[0].input as unknown as PutLogEventsCommandInput;
    if (!sentInput.logEvents) {
      fail();
    }
    expect(sentInput.logEvents[0].message).toContain(`"idType":"AuthUrlRequestor"`);
  });
});
