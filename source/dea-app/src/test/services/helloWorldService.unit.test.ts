/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { mock } from 'ts-mockito';
import { sayBye } from '../../app/resources/say-bye';
import { sayHello } from '../../app/resources/say-hello';

describe('helloWorld service', () => {
  it('should say hello', async () => {
    const event: APIGatewayProxyEventV2 = mock();
    const context: Context = mock();
    const response = await sayHello(event, context);
    if (typeof response === 'string') {
      fail();
    } else {
      expect(response.body).toEqual('Hello DEA!');
    }
  });

  it('should say bye', async () => {
    const event: APIGatewayProxyEventV2 = mock();
    const context: Context = mock();
    const response = await sayBye(event, context);
    if (typeof response === 'string') {
      fail();
    } else {
      expect(response.body).toEqual('Bye DEA!');
    }
  });
});
