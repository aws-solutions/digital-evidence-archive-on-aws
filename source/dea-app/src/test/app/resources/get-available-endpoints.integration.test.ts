/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '../../../app/exceptions/validation-exception';
import { LambdaProviders } from '../../../app/resources/dea-gateway-proxy-handler';
import { getAvailableEndpointsForUser } from '../../../app/resources/get-available-endpoints';
import { createTestProvidersObject, dummyContext, getDummyEvent } from '../../integration-objects';

interface AvailableEndpointsBody {
  endpoints: string[];
}

describe('get available endpoints', () => {
  const testProviders: LambdaProviders = createTestProvidersObject({});

  it('should return the available endpoints for a role', async () => {
    const theEvent = getDummyEvent({
      headers: { deaRole: 'NoPermissionsGroup' },
    });

    const response = await getAvailableEndpointsForUser(theEvent, dummyContext, testProviders);
    expect(response.statusCode).toEqual(200);
    const payload: AvailableEndpointsBody = JSON.parse(response.body);
    expect(payload.endpoints.length).toEqual(1);
    expect(payload.endpoints).toContain('/availableEndpointsGET');
  });

  it('should throw a validation error if the role is not present in headers', async () => {
    const theEvent = getDummyEvent({
      headers: {},
    });

    await expect(getAvailableEndpointsForUser(theEvent, dummyContext, testProviders)).rejects.toThrow(
      ValidationError
    );
  });

  it('should return an empty array if the role has no matching parameter', async () => {
    const theEvent = getDummyEvent({
      headers: { deaRole: 'BogusRole' },
    });

    const response = await getAvailableEndpointsForUser(theEvent, dummyContext, testProviders);
    expect(response.statusCode).toEqual(200);
    const payload: AvailableEndpointsBody = JSON.parse(response.body);
    expect(payload.endpoints.length).toEqual(0);
  });
});
