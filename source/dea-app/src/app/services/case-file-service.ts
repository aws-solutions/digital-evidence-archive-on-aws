/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '../../models/case-file';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import * as CaseFilePersistence from '../../persistence/case-file';
import { getCaseFileByFileLocation, getCaseFileByUlid } from '../../persistence/case-file';
import { defaultProvider, ModelRepositoryProvider } from '../../persistence/schema/entities';
import {
  generatePresignedUrlsForCaseFile,
  completeUploadForCaseFile,
  defaultDatasetsProvider,
  DatasetsProvider,
} from '../../storage/datasets';
import { ForbiddenError } from '../exceptions/forbidden-exception';
import { NotFoundError } from '../exceptions/not-found-exception';
import { ValidationError } from '../exceptions/validation-exception';

import { getCase } from './case-service';
import { getUser } from './user-service';

export const initiateCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  userUlid: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider,
  datasetsProvider: DatasetsProvider = defaultDatasetsProvider
): Promise<DeaCaseFile> => {
  const caseFile: DeaCaseFile = await CaseFilePersistence.initiateCaseFileUpload(
    deaCaseFile,
    userUlid,
    repositoryProvider
  );

  await generatePresignedUrlsForCaseFile(caseFile, datasetsProvider);
  return caseFile;
};

export const validateInitiateUploadRequirements = async (
  caseFile: DeaCaseFile,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> => {
  await validateUploadRequirements(caseFile, userUlid, repositoryProvider);

  const existingCaseFile = await getCaseFileByFileLocation(
    caseFile.caseUlid,
    caseFile.filePath,
    caseFile.fileName,
    repositoryProvider
  );

  if (existingCaseFile) {
    // todo: the error experience of this scenario can be improved upon based on UX/customer feedback
    // todo: add more protection to prevent creation of 2 files with same filePath+fileName
    if (existingCaseFile.status == CaseFileStatus.PENDING) {
      throw new ValidationError(
        `${existingCaseFile.filePath}${existingCaseFile.fileName} is currently being uploaded. Check again in 60 minutes`
      );
    }
    throw new ValidationError(
      `${existingCaseFile.filePath}${existingCaseFile.fileName} already exists in the DB`
    );
  }
};

export const validateCompleteCaseFileRequirements = async (
  caseFile: DeaCaseFile,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> => {
  await validateUploadRequirements(caseFile, userUlid, repositoryProvider);
  // we know based on request validation that the ulid isn't null, so safe to cast to string
  const existingCaseFile = await getCaseFileByUlid(
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    caseFile.ulid as string,
    caseFile.caseUlid,
    repositoryProvider
  );
  if (!existingCaseFile) {
    throw new NotFoundError(`Could not find file: ${caseFile.ulid} in the DB`);
  }

  if (existingCaseFile.status != CaseFileStatus.PENDING) {
    throw new ValidationError(`Can't complete upload for a file in ${existingCaseFile.status} state`);
  }

  if (existingCaseFile.createdBy !== userUlid) {
    throw new ForbiddenError('Mismatch in user creating and completing file upload');
  }
};

async function validateUploadRequirements(
  caseFile: DeaCaseFile,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> {
  const user = await getUser(userUlid, repositoryProvider);
  if (!user) {
    // Note: before every lambda checks are run to add first time
    // federated users to the db. If the caller is not in the db
    // a server error has occurred
    throw new Error('Could not find case-file uploader as a user in the DB');
  }

  const deaCase = await getCase(caseFile.caseUlid, repositoryProvider);
  if (!deaCase) {
    throw new NotFoundError(`Could not find case: ${caseFile.caseUlid} in the DB`);
  }

  if (deaCase.status != CaseStatus.ACTIVE) {
    throw new ValidationError(`Can't upload a file to case in ${deaCase.status} state`);
  }
}

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
