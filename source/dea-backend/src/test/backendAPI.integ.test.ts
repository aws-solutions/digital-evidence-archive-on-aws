import request from 'supertest';
import { getBackendApiApp } from '../backendAPI';

describe('hello world API', () => {
  describe('GET /hi', () => {
    it('should respond with a greeting', async () => {
      const response = await request(getBackendApiApp()).get('/hi');
      expect(response.status).toEqual(200);
      expect(response.text).toEqual('Hello DEA!');
    });
  });

  describe('GET /bye', () => {
    it('should say bye', async () => {
      const response = await request(getBackendApiApp()).get('/bye');
      expect(response.status).toEqual(200);
      expect(response.text).toEqual('Bye DEA!');
    });
  });
});
