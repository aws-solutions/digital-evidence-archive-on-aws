/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '../models/case-file';
import { caseFileFromEntity } from '../models/projections';
import { CaseFileModelRepositoryProvider, CaseFileModel } from './schema/entities';

export const initiateCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  userUlid: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: CaseFileModelRepositoryProvider = {
    CaseFileModel: CaseFileModel,
  }
): Promise<DeaCaseFile> => {
  const newEntity = await repositoryProvider.CaseFileModel.create({
    ...deaCaseFile,
    isFile: true,
    createdBy: userUlid,
  });
  return caseFileFromEntity(newEntity);
};

export const completeCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: CaseFileModelRepositoryProvider = {
    CaseFileModel: CaseFileModel,
  }
): Promise<DeaCaseFile> => {
  const newEntity = await repositoryProvider.CaseFileModel.update({
    ...deaCaseFile,
  });
  return caseFileFromEntity(newEntity);
};
