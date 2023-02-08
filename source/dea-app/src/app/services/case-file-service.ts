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
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
): Promise<DeaCaseFile> => {
  // need to see who is initiating upload. add that info to s3 and ddb
  // check if file already exists
  // need to add a status to indicate if file has been uploaded or is pending
  // need to add a ttl to clear out incomplete case-files
  const caseFile: DeaCaseFile = await CaseFilePersistence.initiateCaseFileUpload(
    deaCaseFile,
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
  // todo: check if case-file exists and that it is actually pending

  await completeUploadForCaseFile(deaCaseFile, datasetsProvider);

  // update status and remove ttl
  return await CaseFilePersistence.completeCaseFileUpload(deaCaseFile, repositoryProvider);
};
