import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DEAUIStack } from '../src/DEAUIStack';
import { BlockPublicAccess, BucketAccessControl } from 'aws-cdk-lib/aws-s3';

describe('DEAUIStack', () => {
  beforeAll(() => {
    process.env.STAGE = 'test';
  });

  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    const app = new cdk.App();

    // Create the DeaBackendStack.
    const deaUiStack = new DEAUIStack(app, 'DeaBackendStack');

    // Prepare the stack for assertions.
    const template = Template.fromStack(deaUiStack);

    // Assert it creates the api with the correct properties...
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Description: 'distribution api'
    });

    template.hasResourceProperties('AWS::S3::Bucket', {
      AccessControl: BucketAccessControl.PRIVATE,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      }
    });

    expect(template).toMatchSnapshot();
  });
});
