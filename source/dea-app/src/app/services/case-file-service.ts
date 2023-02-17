/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '../../models/case-file';
import * as CaseFilePersistence from '../../persistence/case-file';
import { defaultProvider } from '../../persistence/schema/entities';
import {
  generatePresignedUrlsForCaseFile,
  completeUploadForCaseFile,
  defaultDatasetsProvider,
  DatasetsProvider,
} from '../../storage/datasets';

export const initiateCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  userUlid: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
): Promise<DeaCaseFile> => {
  // todo: check if file already exists
  const caseFile: DeaCaseFile = await CaseFilePersistence.initiateCaseFileUpload(
    deaCaseFile,
    userUlid,
    repositoryProvider
  );

  await generatePresignedUrlsForCaseFile(caseFile, datasetsProvider);
  return caseFile;
};

export const completeCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
): Promise<DeaCaseFile> => {
  await completeUploadForCaseFile(deaCaseFile, datasetsProvider);
  return await CaseFilePersistence.completeCaseFileUpload(deaCaseFile, repositoryProvider);
};
