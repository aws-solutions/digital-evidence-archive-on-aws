jest.mock('../../services/helloWorldService', () => ({
  HelloWorldService: jest.fn().mockImplementation(() => ({
    sayHello: async () => {
      return 'nihao';
    },
    sayBye: async () => {
      return 'zaijian';
    }
  }))
}));

import request from 'supertest';
import { getBackendApiApp } from '../../backendAPI';

//this is covered already and provided as an example of jest import mocking
describe('backend api with jest mocks example', () => {
  describe('GET /bye', () => {
    it('should respond with mocked value from jest', async () => {
      const agent = request(getBackendApiApp());

      const response = await agent.get('/bye');
      expect(response.status).toEqual(200);
      expect(response.text).toEqual('zaijian');
    });
  });
});
