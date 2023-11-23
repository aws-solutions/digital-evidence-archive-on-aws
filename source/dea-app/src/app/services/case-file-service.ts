/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { OneTableError, Paged } from 'dynamodb-onetable';
import { logger } from '../../logger';
import {
  CaseFileDTO,
  CompleteCaseFileUploadDTO,
  CompleteCaseFileUploadObject,
  DeaCaseFile,
  DeaCaseFileResult,
  DeaCaseFileUpload,
  InitiateCaseFileUploadDTO,
  UploadDTO,
} from '../../models/case-file';
import { CaseFileStatus } from '../../models/case-file-status';
import { CaseStatus } from '../../models/case-status';
import { DeaUser } from '../../models/user';
import * as CaseFilePersistence from '../../persistence/case-file';
import { getCaseFileByFileLocation, getCaseFileByUlid } from '../../persistence/case-file';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { getUsers } from '../../persistence/user';
import { completeUploadForCaseFile, DatasetsProvider, createCaseFileUpload } from '../../storage/datasets';
import { NotFoundError } from '../exceptions/not-found-exception';
import { ValidationError } from '../exceptions/validation-exception';
import { getRequiredCase } from './case-service';
import { getUser } from './user-service';

export const initiateCaseFileUpload = async (
  uploadDTO: InitiateCaseFileUploadDTO,
  userUlid: string,
  sourceIp: string,
  repositoryProvider: ModelRepositoryProvider,
  datasetsProvider: DatasetsProvider,
  // retryDepth exists to limit recursive retry count
  retryDepth = 0
): Promise<DeaCaseFileUpload> => {
  try {
    const caseFile: DeaCaseFile = await CaseFilePersistence.initiateCaseFileUpload(
      uploadDTO,
      userUlid,
      repositoryProvider
    );
    return await createCaseFileUpload(caseFile, datasetsProvider, sourceIp, userUlid);
  } catch (error) {
    if ('code' in error && error.code === 'UniqueError' && retryDepth === 0) {
      // potential race-condition when we ran validate earlier. double check to ensure no case-file exists
      await validateInitiateUploadRequirements(uploadDTO, userUlid, repositoryProvider);

      // if no case-file exists, it means that the case-file was cleared by ttl after failed upload
      // we need to clear the unique file item in ddb and retry request.
      // https://doc.onetable.io/api/model/methods/#unique-fields
      await repositoryProvider.table.deleteItem({
        PK: `_unique#CaseFile#GSI2PK#CASE#${uploadDTO.caseUlid}#${uploadDTO.filePath}${uploadDTO.fileName}#`,
        SK: '_unique#',
      });

      return initiateCaseFileUpload(uploadDTO, userUlid, sourceIp, repositoryProvider, datasetsProvider, 1);
    } else {
      throw error;
    }
  }
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
      throw new ValidationError('File is currently being uploaded. Check again in 60 minutes');
    }
    throw new ValidationError('File already exists in the DB');
  }
};

export const validateCompleteCaseFileRequirements = async (
  completeCaseFileUploadDTO: CompleteCaseFileUploadDTO,
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFile> => {
  await validateUploadRequirements(completeCaseFileUploadDTO, userUlid, repositoryProvider);
  const existingCaseFile = await getRequiredCaseFile(
    completeCaseFileUploadDTO.caseUlid,
    completeCaseFileUploadDTO.ulid,
    repositoryProvider
  );

  if (existingCaseFile.status != CaseFileStatus.PENDING) {
    throw new ValidationError('File is in incorrect state for upload');
  }

  if (existingCaseFile.createdBy !== userUlid) {
    throw new ValidationError('Mismatch in user creating and completing file upload');
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
    throw new Error('Could not find case-file upload user');
  }

  const deaCase = await getRequiredCase(caseFileUploadRequest.caseUlid, repositoryProvider);

  if (deaCase.status != CaseStatus.ACTIVE) {
    throw new ValidationError('Case is in an invalid state for uploading files');
  }
}

export const completeCaseFileUpload = async (
  deaCaseFile: CompleteCaseFileUploadObject,
  repositoryProvider: ModelRepositoryProvider,
  datasetsProvider: DatasetsProvider
): Promise<DeaCaseFileResult> => {
  await completeUploadForCaseFile(deaCaseFile, datasetsProvider);
  return await CaseFilePersistence.completeCaseFileUpload(deaCaseFile, repositoryProvider);
};

export const createCaseAssociation = async (
  deaCaseFile: DeaCaseFile,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFileResult> => {
  try {
    return await CaseFilePersistence.createCaseFileAssociation(deaCaseFile, repositoryProvider);
  } catch (error) {
    const oneTableError: OneTableError = error;
    const conditionalcheckfailed = oneTableError.context?.err?.CancellationReasons.find(
      (reason: { Code: string }) => reason.Code === 'ConditionalCheckFailed'
    );
    if (oneTableError.code === 'TransactionCanceledException' && conditionalcheckfailed) {
      const errorMessage = `A file with the same name has been previously uploaded or attached to the case.`;
      logger.info(errorMessage, deaCaseFile);
      throw new ValidationError(errorMessage);
    }
    throw error;
  }
};

export const listCaseFilesByFilePath = async (
  caseId: string,
  filePath: string,
  repositoryProvider: ModelRepositoryProvider,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<DeaCaseFileResult>> => {
  return await CaseFilePersistence.listCaseFilesByFilePath(
    caseId,
    filePath,
    limit,
    repositoryProvider,
    nextToken
  );
};

export const hydrateUsersForFiles = async (
  files: DeaCaseFileResult[],
  repositoryProvider: ModelRepositoryProvider
): Promise<CaseFileDTO[]> => {
  // get all unique user ulids referenced on the files
  const userUlids = [
    ...new Set([
      ...files.map((file) => file.createdBy),
      ...files
        .filter((file) => file.associationCreatedBy?.length)
        .map((file) => file.associationCreatedBy ?? ''),
    ]),
  ];
  // fetch the users
  const userMap = await getUsers(userUlids, repositoryProvider);
  return caseFilesToDTO(files, userMap);
};

const caseFilesToDTO = (
  files: Paged<DeaCaseFileResult>,
  userMap: Map<string, DeaUser>
): Paged<CaseFileDTO> => {
  return files.map((file) => {
    const user = userMap.get(file.createdBy);
    let createdBy = file.createdBy;
    if (user) {
      createdBy = `${user?.firstName} ${user?.lastName}`;
    }
    const associationUser = userMap.get(file.associationCreatedBy ?? '');
    const associationCreatedBy = associationUser
      ? `${associationUser?.firstName} ${associationUser?.lastName}`
      : file.associationCreatedBy;
    return {
      ulid: file.ulid,
      caseUlid: file.caseUlid,
      fileName: file.fileName,
      contentType: file.contentType,
      createdBy,
      filePath: file.filePath,
      fileSizeBytes: file.fileSizeBytes,
      sha256Hash: file.sha256Hash,
      status: file.status,
      created: file.created,
      updated: file.updated,
      isFile: file.isFile,
      reason: file.reason,
      details: file.details,
      fileS3Key: file.fileS3Key,
      dataVaultUlid: file.dataVaultUlid,
      executionId: file.executionId,
      associationCreatedBy,
      associationDate: file.associationDate,
      dataVaultUploadDate: file.dataVaultUploadDate,
    };
  });
};

export const getCaseFile = async (
  caseId: string,
  ulid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFileResult | undefined> => {
  return await CaseFilePersistence.getCaseFileByUlid(ulid, caseId, repositoryProvider);
};

export const getRequiredCaseFile = async (
  caseId: string,
  fileId: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaCaseFile> => {
  const caseFile = await getCaseFileByUlid(fileId, caseId, repositoryProvider);
  if (!caseFile) {
    throw new NotFoundError('Could not find file');
  }
  return caseFile;
};

export const deleteCaseAssociation = async (
  deaCaseFile: DeaCaseFile,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> => {
  await CaseFilePersistence.deleteCaseFileAssociation(deaCaseFile, repositoryProvider);
};
