#!/usr/bin/env node
/**********************************************************************************************************************
 *  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib/core';
import { Construct, IConstruct } from 'constructs';
import { NodejsLayerVersion } from '../awsnodejs-lambda-layer/layers';

/**
 * An example of how CDK Aspects can be used. This example adds a lambda LayerVersion
 * to the lambda construct node using CDK Aspects.
 */
export class LambdaAspect extends Construct implements cdk.IAspect {
    readonly nodejsLayer: lambda.LayerVersion;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        this.nodejsLayer = new NodejsLayerVersion(this, id, {
            entry: 'lambda/layers/aws-nodesdk-custom-config',
            compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
            description: 'This layer configures AWS Node SDK initialization',
        });
    }

    public visit(node: IConstruct): void {
        // the various rules that apply to the lambda function
        this.applyUserAgentAspect(node); // add user agent for node and python
    }

    /**
     * This method is an example of how CDK Aspects can be applied. This specific
     * method injects a custom user-agent when making AWS SDK API calls to AWS services
     *
     * @param node: cdk.Construct
     */
    private applyUserAgentAspect(node: IConstruct): void {
        const solutionID = node.node.tryGetContext('solution_id');
        const solutionVersion = node.node.tryGetContext('solution_version');

        if (node instanceof lambda.Function) {
            if (node.runtime.family == lambda.RuntimeFamily.NODEJS) {
                node.addLayers(this.nodejsLayer);
                node.addEnvironment(
                    'AWS_SDK_USER_AGENT',
                    `{ "customUserAgent": "AwsSolution/${solutionID}/${solutionVersion}" }`
                );
            }
        }
    }
}
