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

import { Template, Capture } from 'aws-cdk-lib/assertions';
import { App } from 'aws-cdk-lib';
import CdkSolution = require('../lib/cdk-solution-stack');
import 'jest-cdk-snapshot';
/*
 * Sample snapshot test
 */
test('Sample snapshot test', () => {
    const app = new App();
    // WHEN
    const stack = new CdkSolution.HelloSolutionsConstructsStack(
        app,
        'MyTestStack'
    );
    const template = Template.fromStack(stack);
    console.log(JSON.stringify(template));
    expect(template).toMatchSnapshot();
});

/*
 * Sample unit test
 */
test('Test to make sure the Lambda function is there w/ proper runtime', () => {
    const app = new App();
    // WHEN
    const stack = new CdkSolution.HelloSolutionsConstructsStack(
        app,
        'MyTestStack'
    );
    const template = Template.fromStack(stack);
    const runtimeCapture = new Capture();

    template.hasResourceProperties('AWS::Lambda::Function', {
        Runtime: runtimeCapture,
    });

    expect(runtimeCapture.asString()).toEqual('nodejs14.x');
});
