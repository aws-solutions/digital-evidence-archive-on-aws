/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { NotAuthorizedException } from '@aws-sdk/client-cognito-identity';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getCredentials } from '../../../app/resources/get-credentials';

import { dummyContext, getDummyEvent } from '../../integration-objects';

describe('get-credentials', () => {
  it('should throw an error if the id token is not valid', async () => {
    const event = getDummyEvent({
      headers: {
        cookie:
          'idToken={"id_token": "fake.fake.fake","access_token": "fake.fake.fake","refresh_token": "fake.fake.fake","expires_in": 43200,"token_type": "Bearer"}',
      },
    });

    await expect(getCredentials(event, dummyContext)).rejects.toThrow(NotAuthorizedException);
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getCredentials(getDummyEvent(), dummyContext)).rejects.toThrow(ValidationError);
  });
});
