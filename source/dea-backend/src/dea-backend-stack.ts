/* eslint-disable @typescript-eslint/explicit-member-accessibility */
import * as path from "path";
import { LoggingService } from "@aws/workbench-core-logging";
import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class DeaBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const hello = new lambda.Function(this, "HelloHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset(path.join(__dirname, "..", "src")),
      handler: "hello.handler",
    });

    // defines an API Gateway REST API resource backed by our "hello" function.
    // eslint-disable-next-line no-new
    new apigw.LambdaRestApi(this, "Endpoint", {
      handler: hello,
    });
  }
}
