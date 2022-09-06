/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import * as api from 'aws-cdk-lib/aws-apigateway';
import {
    ApiGatewayToLambda,
    ApiGatewayToLambdaProps,
} from '@aws-solutions-constructs/aws-apigateway-lambda';
import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';

import * as path from 'path';

export class HelloSolutionsConstructsStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here
        const api_lambda_props: ApiGatewayToLambdaProps = {
            lambdaFunctionProps: {
                code: Code.fromAsset(
                    path.join(__dirname, '../lambda/example-function-js')
                ),
                runtime: Runtime.NODEJS_14_X,
                handler: 'index.handler',
            },
            apiGatewayProps: {
                defaultMethodOptions: {
                    authorizationType: api.AuthorizationType.IAM,
                },
            },
        };

        new ApiGatewayToLambda(this, 'ApiGatewayToLambda', api_lambda_props);
    }
}
