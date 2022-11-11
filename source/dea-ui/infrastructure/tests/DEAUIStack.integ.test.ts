import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { DeaUiConstruct } from '../src/dea-ui-stack';

describe('DeaUiStack', () => {
  beforeAll(() => {
    process.env.STAGE = 'test';
  });

  afterAll(() => {
    delete process.env.STAGE;
  });

  it('synthesizes the way we expect', () => {
    const app = new cdk.App();

    // Create the DeaUiStack.
    const deaUiConstruct = new DeaUiConstruct(app, 'DeaUiConstruct');

    // Prepare the stack for assertions.
    const template = Template.fromStack(deaUiConstruct);

    // Assert it creates the api with the correct properties...
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Description: 'distribution api',
    });

    template.hasResourceProperties('AWS::S3::Bucket', {
      AccessControl: BucketAccessControl.PRIVATE,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });

    expect(template).toMatchSnapshot();
  });
});
