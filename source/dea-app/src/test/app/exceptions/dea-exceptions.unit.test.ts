/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ForbiddenError, FORBIDDEN_ERROR_NAME } from '../../../app/exceptions/forbidden-exception';
import { NotFoundError, NOT_FOUND_ERROR_NAME } from '../../../app/exceptions/not-found-exception';
import { ValidationError, VALIDATION_ERROR_NAME } from '../../../app/exceptions/validation-exception';

describe('dea exceptions', () => {
  it('should have defined names', () => {
    const notFound = new NotFoundError('');
    const forbidden = new ForbiddenError('');
    const validation = new ValidationError('');

    expect(notFound.name).toEqual(NOT_FOUND_ERROR_NAME);
    expect(forbidden.name).toEqual(FORBIDDEN_ERROR_NAME);
    expect(validation.name).toEqual(VALIDATION_ERROR_NAME);
  });
});
