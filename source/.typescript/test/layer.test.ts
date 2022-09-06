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
import { App, Aspects } from 'aws-cdk-lib';
import * as sinon from 'sinon';
import { assert } from 'sinon';
import * as layer from '../lib/awsnodejs-lambda-layer/layers';
import * as CdkSolution from '../lib/cdk-solution-stack';
import { LambdaAspect } from '../lib/aspects/apply-to-lambda';

/*
 * Sample snapshot test
 */
test('Sample snapshot test', () => {
    const localCopySpy = sinon.spy(
        layer.NodejsLayerVersion,
        'copyFilesSyncRecursively'
    );
    const app = new App();
    // WHEN
    const stack = new CdkSolution.HelloSolutionsConstructsStack(
        app,
        'MyTestStack'
    );
    Aspects.of(stack).add(new LambdaAspect(stack, 'Layer'));
    const template = Template.fromStack(stack);

    const runtimeCapture = new Capture();
    template.hasResourceProperties('AWS::Lambda::LayerVersion', {
        CompatibleRuntimes: [runtimeCapture],
    });

    expect(runtimeCapture.asString()).toEqual('nodejs14.x');

    assert.calledOnce(localCopySpy);
    localCopySpy.restore();
});
