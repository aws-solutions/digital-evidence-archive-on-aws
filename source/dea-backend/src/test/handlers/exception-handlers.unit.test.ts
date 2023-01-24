/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DEALambda, LambdaContext, LambdaEvent, LambdaResult } from '@aws/dea-app';
import { NotFoundError } from '@aws/dea-app/lib/app/exceptions/not-found-exception';
import { ValidationError } from '@aws/dea-app/lib/app/exceptions/validation-exception';
import { ModelRepositoryProvider } from '@aws/dea-app/lib/persistence/schema/entities';
import Joi from 'joi';
import { mock } from 'ts-mockito';
import { createDeaHandler } from '../../handlers/create-dea-handler';

describe('exception handlers', () => {
  it('should handle DEAValidation errors', async () => {
    const sut = createDeaHandler(new class extends DEALambda {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      execute(event: LambdaEvent, context: LambdaContext, repositoryProvider: ModelRepositoryProvider): Promise<LambdaResult> {
        throw new ValidationError('custom validation failed');
      }
    });

    const event: LambdaEvent = mock();
    const context: LambdaContext = mock();

    const actual = await sut(event, context);

    expect(actual).toEqual({
      statusCode: 400,
      body: 'custom validation failed',
    });
  });

  it('should handle NotFound errors', async () => {
    const sut = createDeaHandler(new class extends DEALambda {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      execute(event: LambdaEvent, context: LambdaContext, repositoryProvider: ModelRepositoryProvider): Promise<LambdaResult> {
        throw new NotFoundError('something was not found');
      }
    });

    const event: LambdaEvent = mock();
    const context: LambdaContext = mock();
    const actual = await sut(event, context);
    expect(actual).toEqual({
      statusCode: 404,
      body: 'something was not found',
    });
  });

  it('should handle non-joi errors in the joi handler', async () => {
    const sut = createDeaHandler(new class extends DEALambda {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      execute(event: LambdaEvent, context: LambdaContext, repositoryProvider: ModelRepositoryProvider): Promise<LambdaResult> {
        const err = new ValidationError('no joi here');
        err.name = 'ValidationError';
        throw err;      }
    });

    const event: LambdaEvent = mock();
    const context: LambdaContext = mock();
    const actual = await sut(event, context);
    expect(actual).toEqual({
      statusCode: 400,
      body: 'no joi here',
    });
  });

  it('should handle non custom Errors', async () => {
    const sut = createDeaHandler(new class extends DEALambda {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      execute(event: LambdaEvent, context: LambdaContext, repositoryProvider: ModelRepositoryProvider): Promise<LambdaResult> {
        throw new Error('some unexpected error');
      }
    });

    const event: LambdaEvent = mock();
    const context: LambdaContext = mock();
    const actual = await sut(event, context);
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
    const sut = createDeaHandler(new class extends DEALambda {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async execute(event: LambdaEvent, context: LambdaContext, repositoryProvider: ModelRepositoryProvider): Promise<LambdaResult> {
        Joi.assert({ name: 'bogus' }, schemaObj);
        return { statusCode: 200, body: '' };
      }
    });

    const event: LambdaEvent = mock();
    const context: LambdaContext = mock();
    const actual = await sut(event, context);

    expect(actual).toEqual({
      statusCode: 400,
      body: `"name" length must be at least 10 characters long`,
    });
  });
});
