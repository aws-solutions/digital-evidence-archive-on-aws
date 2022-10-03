import HelloWorldService from './helloWorldService';

describe('helloWorld service', () => {
  let helloWorldService: HelloWorldService;
  beforeAll(() => {
    helloWorldService = new HelloWorldService();
  });

  it('should say hello', async () => {
    const response = await helloWorldService.sayHello();
    expect(response).toEqual('Hello DEA!');
  });

  it('should say bye', async () => {
    const response = await helloWorldService.sayBye();
    expect(response).toEqual('Bye DEA!');
  });
});
