/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import request from 'supertest';
import { mock, when, instance } from 'ts-mockito';
import { getBackendApiApp } from '../../backend-api';
import { HelloWorldService } from '../../services/helloWorldService';

//this is covered already and provided as an example of ts-mockito mocking
describe('backend api with mocks example', () => {
  let helloWorldService: HelloWorldService;

  beforeAll(() => {
    helloWorldService = mock(HelloWorldService);
    when(helloWorldService.sayBye()).thenResolve('ciao!');
  });

  describe('GET /bye', () => {
    it('should respond with ciao!', async () => {
      const agent = request(
        getBackendApiApp({
          helloWorldService: instance(helloWorldService),
        })
      );

      const response = await agent.get('/bye');
      expect(response.status).toEqual(200);
      expect(response.text).toEqual('ciao!');
    });
  });
});
