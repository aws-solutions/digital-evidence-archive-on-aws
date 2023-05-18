/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { OWNER_ACTIONS } from '../../models/case-action';
import { CaseUser } from '../../models/case-user';
import { CaseOwnerDTO, CaseUserDTO } from '../../models/dtos/case-user-dto';
import { getCase } from '../../persistence/case';
import * as CaseUserPersistence from '../../persistence/case-user';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { getUser } from '../../persistence/user';
import { NotFoundError } from '../exceptions/not-found-exception';
import { ValidationError, VALIDATION_ERROR_NAME } from '../exceptions/validation-exception';

export const getCaseUser = async (
  caseUserIds: {
    readonly caseUlid: string;
    readonly userUlid: string;
  },
  repositoryProvider: ModelRepositoryProvider
): Promise<CaseUser | undefined> => {
  return CaseUserPersistence.getCaseUser(caseUserIds, repositoryProvider);
};

export const createCaseUserMembershipFromDTO = async (
  caseUserDto: CaseUserDTO,
  repositoryProvider: ModelRepositoryProvider
): Promise<CaseUser> => {
  const user = await getUser(caseUserDto.userUlid, repositoryProvider);
  if (!user) {
    throw new NotFoundError(`User with ulid ${caseUserDto.userUlid} not found.`);
  }
  const deaCase = await getCase(caseUserDto.caseUlid, undefined, repositoryProvider);

  if (!deaCase) {
    throw new NotFoundError(`Case with ulid ${caseUserDto.caseUlid} not found.`);
  }

  try {
    const caseUser: CaseUser = {
      ...caseUserDto,
      userFirstName: user.firstName,
      userLastName: user.lastName,
      caseName: deaCase.name,
    };
    return await createCaseUserMembership(caseUser, repositoryProvider);
  } catch (error) {
    // if ConditionalCheckFailedException  implies  <caseUlid,userUlid> already exists.
    if (typeof error === 'object' && error['code'] === 'ConditionalCheckFailedException') {
      throw new ValidationError('Requested Case-User Membership found');
    }
    throw error;
  }
};

export const updateCaseUserMembershipFromDTO = async (
  caseUserDTO: CaseUserDTO,
  repositoryProvider: ModelRepositoryProvider
): Promise<CaseUser> => {
  const existingMembership = await CaseUserPersistence.getCaseUser(
    { caseUlid: caseUserDTO.caseUlid, userUlid: caseUserDTO.userUlid },
    repositoryProvider
  );
  if (!existingMembership) {
    throw new NotFoundError('Requested Case-User Membership not found');
  }

  const membershipForUpdate = Object.assign(
    {},
    {
      ...existingMembership,
      actions: caseUserDTO.actions,
    }
  );

  return CaseUserPersistence.updateCaseUser(membershipForUpdate, repositoryProvider);
};

export const createCaseUserMembership = async (
  caseUser: CaseUser,
  repositoryProvider: ModelRepositoryProvider
): Promise<CaseUser> => {
  return await CaseUserPersistence.createCaseUser(caseUser, repositoryProvider);
};

export const getCaseUsersForUser = async (
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<CaseUser>> => {
  return CaseUserPersistence.listCaseUsersByUser(userUlid, repositoryProvider, nextToken, limit);
};

export const deleteCaseUsersForCase = async (
  caseUlid: string,
  repositoryProvider: ModelRepositoryProvider
) => {
  let batch = {};
  const caseUsers = await CaseUserPersistence.listCaseUsersByCase(
    caseUlid,
    repositoryProvider,
    /*next=*/ undefined,
    /*limit=*/ 25
  );
  for (const caseUser of caseUsers) {
    await CaseUserPersistence.deleteCaseUser(
      { userUlid: caseUser.userUlid, caseUlid: caseUser.caseUlid },
      repositoryProvider,
      batch
    );
  }
  await repositoryProvider.table.batchWrite(batch);

  let next = caseUsers.next;
  while (next) {
    batch = {};
    const additionalCaseUsers = await CaseUserPersistence.listCaseUsersByCase(
      caseUlid,
      repositoryProvider,
      next,
      /* limit */ 25
    );
    for (const caseUser of additionalCaseUsers) {
      await CaseUserPersistence.deleteCaseUser(
        { userUlid: caseUser.userUlid, caseUlid: caseUser.caseUlid },
        repositoryProvider,
        batch
      );
    }
    await repositoryProvider.table.batchWrite(batch);
    next = additionalCaseUsers.next;
  }
};

export const deleteCaseUser = async (
  userUlid: string,
  caseUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<void> => {
  await CaseUserPersistence.deleteCaseUser({ userUlid, caseUlid }, repositoryProvider);
};

export const getCaseUsersForCase = async (
  caseUlid: string,
  repositoryProvider: ModelRepositoryProvider,
  nextToken: object | undefined,
  limit = 30
): Promise<Paged<CaseUser>> => {
  return CaseUserPersistence.listCaseUsersByCase(caseUlid, repositoryProvider, nextToken, limit);
};

export const createCaseOwnerFromDTO = async (
  caseOwnerDTO: CaseOwnerDTO,
  repositoryProvider: ModelRepositoryProvider
): Promise<CaseUser> => {
  const caseUserDto: CaseUserDTO = { ...caseOwnerDTO, actions: OWNER_ACTIONS };
  try {
    return await createCaseUserMembershipFromDTO(caseUserDto, repositoryProvider);
  } catch (error) {
    //if membership found then we proceed with the update.
    if (typeof error === 'object' && error['name'] === VALIDATION_ERROR_NAME) {
      return await updateCaseUserMembershipFromDTO(caseUserDto, repositoryProvider);
    }
    throw error;
  }
};
