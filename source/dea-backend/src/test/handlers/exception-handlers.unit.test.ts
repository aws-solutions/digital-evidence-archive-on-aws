/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { dummyContext, dummyEvent, ForbiddenError, NotFoundError, ValidationError } from '@aws/dea-app';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import Joi from 'joi';
import { createDeaHandler, NO_ACL } from '../../handlers/create-dea-handler';

describe('exception handlers', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const preExecutionChecks = async (event: APIGatewayProxyEvent, context: Context) => {
    return;
  };

  it('should handle Forbidden errors', async () => {
    const sut = createDeaHandler(
      async () => {
        throw new ForbiddenError('you shall not pass');
      },
      NO_ACL,
      preExecutionChecks
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
      preExecutionChecks
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
      preExecutionChecks
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 404,
      body: 'something was not found',
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
      preExecutionChecks
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
      preExecutionChecks
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
      preExecutionChecks
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
      preExecutionChecks
    );

    const actual = await sut(dummyEvent, dummyContext);
    expect(actual).toEqual({
      statusCode: 500,
      body: 'Server Error',
    });
  });
});
