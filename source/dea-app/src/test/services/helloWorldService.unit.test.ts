/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { sayBye } from '../../app/resources/say-bye';
import { sayHello } from '../../app/resources/say-hello';

describe('helloWorld service', () => {
  it('should say hello', async () => {
    const response = await sayHello();
    if (typeof response === 'string') {
      fail();
    } else {
      expect(response.body).toEqual('Hello DEA!');
    }
  });

  it('should say bye', async () => {
    const response = await sayBye();
    if (typeof response === 'string') {
      fail();
    } else {
      expect(response.body).toEqual('Bye DEA!');
    }
  });
});
