/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '../../models/case-file';
import * as CaseFilePersistence from '../../persistence/case-file';
import { defaultProvider } from '../../persistence/schema/entities';

export const initiateCaseFileUpload = async (
    deaCaseFile: DeaCaseFile,
    /* the default case is handled in e2e tests */
    /* istanbul ignore next */
    repositoryProvider = defaultProvider
): Promise<DeaCaseFile> => {
    return await CaseFilePersistence.initiateCaseFileUpload(deaCaseFile, repositoryProvider);
};

export const completeCaseFileUpload = async (
    deaCaseFile: DeaCaseFile,
    /* the default case is handled in e2e tests */
    /* istanbul ignore next */
    repositoryProvider = defaultProvider
): Promise<DeaCaseFile> => {
    return await CaseFilePersistence.completeCaseFileUpload(deaCaseFile, repositoryProvider);
};