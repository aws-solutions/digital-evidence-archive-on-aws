/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  dummyContext,
  getDummyEvent,
  ForbiddenError,
  getTestAuditService,
  NotFoundError,
  ReauthenticationError,
  ValidationError,
} from '@aws/dea-app';
import { TestAuditService } from '@aws/dea-app/lib/test/services/test-audit-service-provider';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import Joi from 'joi';
import { createDeaHandler, NO_ACL } from '../../handlers/create-dea-handler';

describe('exception handlers', () => {
  const OLD_ENV = process.env;
  let testAuditService: TestAuditService;
  let dummyEvent: APIGatewayProxyEvent;

  beforeAll(() => {
    testAuditService = getTestAuditService();
    dummyEvent = getDummyEvent();
  });

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.AUDIT_LOG_GROUP_NAME = 'TESTGROUP';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const preExecutionChecks = async (_event: APIGatewayProxyEvent, _context: Context) => {
    return;
  };

  it('should handle Forbidden errors', async () => {
    const sut = createDeaHandler(
      async () => {
        throw new ForbiddenError('you shall not pass');
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 403,
      body: 'Forbidden',
    });
  });

  it('should handle DEAValidation errors', async () => {
    const sut = createDeaHandler(
      async () => {
        throw new ValidationError('custom validation failed');
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);

    expect(actual).toEqual({
      statusCode: 400,
      body: 'custom validation failed',
    });
  });

  it('should handle NotFound errors', async () => {
    const sut = createDeaHandler(
      async () => {
        throw new NotFoundError('something was not found');
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 404,
      body: 'something was not found',
    });
  });

  it('should handle Reauthentication errors', async () => {
    const sut = createDeaHandler(
      async () => {
        throw new ReauthenticationError('Go back to start and do not collect 200 dollars.');
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 412,
      body: 'Reauthenticate',
    });
  });

  it('should handle non-joi errors in the joi handler', async () => {
    const sut = createDeaHandler(
      async () => {
        const err = new ValidationError('no joi here');
        err.name = 'ValidationError';
        throw err;
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 400,
      body: 'no joi here',
    });
  });

  it('should handle non custom Errors', async () => {
    const sut = createDeaHandler(
      async () => {
        throw new Error('some unexpected error');
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 500,
      body: 'An error occurred',
    });
  });

  it('should handle JOI validation errors', async () => {
    const schemaObj = Joi.object({
      name: Joi.string().min(10).required(),
      addy: Joi.string().min(10).required(),
    });
    const sut = createDeaHandler(
      async () => {
        Joi.assert({ name: 'bogus' }, schemaObj);
        return { statusCode: 200, body: '' };
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);

    expect(actual).toEqual({
      statusCode: 400,
      body: `"name" length must be at least 10 characters long`,
    });
  });

  it('should catch any thrown expression', async () => {
    const sut = createDeaHandler(
      async () => {
        throw 'ItInTheOcean';
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 500,
      body: 'Server Error',
    });
  });

  it('should handle Throttling errors', async () => {
    const sut = createDeaHandler(
      async () => {
        const throttlingException = new Error('Rate exceeded');
        throttlingException.name = 'ThrottlingException';
        throw throttlingException;
      },
      NO_ACL,
      preExecutionChecks,
      testAuditService.service
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 429,
      body: 'Rate exceeded',
    });
  });
});
