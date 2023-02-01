/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Joi from 'joi';
import { logger } from '../../logger';
import { DeaCaseFile } from '../../models/case-file';
import { initiateCaseFileUploadSchema } from '../../models/validation/case-file';
import { defaultProvider } from '../../persistence/schema/entities';
import { ValidationError } from '../exceptions/validation-exception';
import * as CaseFileService from '../services/case-file-service';
import { DEAGatewayProxyHandler } from './dea-gateway-proxy-handler';

export const initiateCaseFileUpload: DEAGatewayProxyHandler = async (
    event,
    context,
    /* the default case is handled in e2e tests */
    /* istanbul ignore next */
    repositoryProvider = defaultProvider
) => {
    logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
    logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

    if (!event.body) {
        throw new ValidationError('Initiate case file upload payload missing.');
    }

    const deaCaseFile: DeaCaseFile = JSON.parse(event.body);
    Joi.assert(deaCaseFile, initiateCaseFileUploadSchema);

    const updateBody = await CaseFileService.initiateCaseFileUpload(deaCaseFile, repositoryProvider);

    return {
        statusCode: 200,
        body: JSON.stringify(updateBody),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    };
};
