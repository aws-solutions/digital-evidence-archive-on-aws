import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { DeaBackendStack } from '../dea-backend-stack';

describe('DeaBackendStack', () => {
  beforeAll(() => {
    process.env.STAGE = 'test';
  });

  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    const app = new cdk.App();

    // Create the DeaBackendStack.
    const deaBackendStack = new DeaBackendStack(app, 'DeaBackendStack');

    // Prepare the stack for assertions.
    const template = Template.fromStack(deaBackendStack);

    // Assert it creates the function with the correct properties...
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Description: 'Backend API'
    });

    template.hasResourceProperties('AWS::Lambda::Function', {
      Handler: 'index.handler',
      Runtime: Runtime.NODEJS_16_X.name
    });

    expect(template).toMatchSnapshot();
  });
});
