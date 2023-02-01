/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase } from '../../models/case';
import { DeaCaseFile } from '../../models/case-file';
import { CaseStatus } from '../../models/case-status';
import { caseFromEntity } from '../../models/projections';
import * as CasePersistence from '../../persistence/case';
import * as CaseFilePersistence from '../../persistence/case-file';
import * as CaseUserPersistence from '../../persistence/case-user';
import { isDefined } from '../../persistence/persistence-helpers';
import { CaseType, defaultProvider } from '../../persistence/schema/entities';

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