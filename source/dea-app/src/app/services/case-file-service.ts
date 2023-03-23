/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import {
  CompleteCaseFileUploadDTO,
  DeaCaseFile,
  InitiateCaseFileUploadDTO,
  UploadDTO,
} from '../../models/case-file';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import * as CaseFilePersistence from '../../persistence/case-file';
import { getCaseFileByFileLocation, getCaseFileByUlid } from '../../persistence/case-file';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import {
  generatePresignedUrlsForCaseFile,
  completeUploadForCaseFile,
  DatasetsProvider,
} from '../../storage/datasets';
import { ForbiddenError } from '../exceptions/forbidden-exception';
import { NotFoundError } from '../exceptions/not-found-exception';
import { ValidationError } from '../exceptions/validation-exception';

import { getCase } from './case-service';
import { getUser } from './user-service';

export const initiateCaseFileUpload = async (
  uploadDTO: InitiateCaseFileUploadDTO,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider,
  datasetsProvider: DatasetsProvider
): Promise<DeaCaseFile> => {
  const { chunkSizeBytes, ...inputDTO } = uploadDTO;
  const caseFile: DeaCaseFile = await CaseFilePersistence.initiateCaseFileUpload(
    inputDTO,
    userUlid,
    repositoryProvider
  );

  await generatePresignedUrlsForCaseFile(caseFile, datasetsProvider, chunkSizeBytes);
  return caseFile;
};

export const validateInitiateUploadRequirements = async (
  initiateUploadDTO: InitiateCaseFileUploadDTO,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> => {
  await validateUploadRequirements(initiateUploadDTO, userUlid, repositoryProvider);

  const existingCaseFile = await getCaseFileByFileLocation(
    initiateUploadDTO.caseUlid,
    initiateUploadDTO.filePath,
    initiateUploadDTO.fileName,
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
  completeCaseFileUploadDTO: CompleteCaseFileUploadDTO,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFile> => {
  await validateUploadRequirements(completeCaseFileUploadDTO, userUlid, repositoryProvider);
  const existingCaseFile = await getCaseFileByUlid(
    completeCaseFileUploadDTO.ulid,
    completeCaseFileUploadDTO.caseUlid,
    repositoryProvider
  );
  if (!existingCaseFile) {
    throw new NotFoundError(`Could not find file: ${completeCaseFileUploadDTO.ulid} in the DB`);
  }

  if (existingCaseFile.status != CaseFileStatus.PENDING) {
    throw new ValidationError(`Can't complete upload for a file in ${existingCaseFile.status} state`);
  }

  if (existingCaseFile.createdBy !== userUlid) {
    throw new ForbiddenError('Mismatch in user creating and completing file upload');
  }

  return existingCaseFile;
};

async function validateUploadRequirements(
  caseFileUploadRequest: UploadDTO,
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

  const deaCase = await getCase(caseFileUploadRequest.caseUlid, repositoryProvider);
  if (!deaCase) {
    throw new NotFoundError(`Could not find case: ${caseFileUploadRequest.caseUlid} in the DB`);
  }

  if (deaCase.status != CaseStatus.ACTIVE) {
    throw new ValidationError(`Can't upload a file to case in ${deaCase.status} state`);
  }
}

export const completeCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  repositoryProvider: ModelRepositoryProvider,
  datasetsProvider: DatasetsProvider
): Promise<DeaCaseFile> => {
  await completeUploadForCaseFile(deaCaseFile, datasetsProvider);
  return await CaseFilePersistence.completeCaseFileUpload(deaCaseFile, repositoryProvider);
};

export const listCaseFilesByFilePath = async (
  caseId: string,
  filePath: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  limit = 30,
  repositoryProvider: ModelRepositoryProvider,
  nextToken?: object
): Promise<Paged<DeaCaseFile>> => {
  return CaseFilePersistence.listCaseFilesByFilePath(caseId, filePath, limit, repositoryProvider, nextToken);
};

export const getCaseFile = async (
  caseId: string,
  ulid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFile | undefined> => {
  return CaseFilePersistence.getCaseFileByUlid(ulid, caseId, repositoryProvider);
};
