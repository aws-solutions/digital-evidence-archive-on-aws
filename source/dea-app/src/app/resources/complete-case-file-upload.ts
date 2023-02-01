/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { logger } from '../../logger';
import { DeaCaseFile } from '../../models/case-file';
import { completeCaseFileUploadSchema } from '../../models/validation/case-file';
import { defaultProvider } from '../../persistence/schema/entities';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseFileService from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const completeCaseFileUpload: DEAGatewayProxyHandler = async (
    event,
    context,
    /* the default case is handled in e2e tests */
    /* istanbul ignore next */
    repositoryProvider = defaultProvider
) => {
    logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
    logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

    if (!event.body) {
        throw new ValidationError('Complete case file upload payload missing.');
    }

    const deaCaseFile: DeaCaseFile = JSON.parse(event.body);
    Joi.assert(deaCaseFile, completeCaseFileUploadSchema);

    const updateBody = await CaseFileService.completeCaseFileUpload(deaCaseFile, repositoryProvider);

    return {
        statusCode: 200,
        body: JSON.stringify(updateBody),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    };
};
