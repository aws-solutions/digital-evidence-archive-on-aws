import request from 'supertest';
import backendAPIApp from './backendAPI';

describe('hello world API', () => {
  describe('GET /hi', () => {
    it('should respond with a greeting', async () => {
      const response = await request(backendAPIApp).get('/hi');
      expect(response.status).toEqual(200);
      expect(response.text).toEqual('Hello DEA!');
    });
  });

  describe('GET /bye', () => {
    it('should say bye', async () => {
      const response = await request(backendAPIApp).get('/bye');
      expect(response.status).toEqual(200);
      expect(response.text).toEqual('Bye DEA!');
    });
  });
});
