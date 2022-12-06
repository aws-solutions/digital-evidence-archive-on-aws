/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Context, APIGatewayProxyCallback, APIGatewayEvent } from 'aws-lambda';
import { HelloWorldService } from '../services/helloWorldService';

exports.handler = async function (event: APIGatewayEvent, context: Context,
                   callback: APIGatewayProxyCallback) {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);
    console.log(`Context: ${JSON.stringify(context, null, 2)}`);

    const helloWorldService = new HelloWorldService();
    const message = await helloWorldService.sayHello();

    return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "success",
          message: message,
        }),
      };
};