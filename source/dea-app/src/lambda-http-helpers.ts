/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ValidationError } from "./app/exceptions/validation-exception";
import { logger } from "./logger";

export const getRequiredPathParam = (event: APIGatewayProxyEventV2, paramName: string): string => {
    
    if (event.pathParameters) {
        const value = event.pathParameters[paramName];
        if (value) {
            return value;
        }
    }

    logger.error('Required path param missing', {rawPath: event.rawPath, pathParams: JSON.stringify(event.pathParameters)});
    throw new ValidationError(`Required path param '${paramName}' is missing.`);
}