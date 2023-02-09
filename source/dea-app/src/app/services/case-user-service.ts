/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { CaseUser } from '../../models/case-user';
import { CaseUserDTO } from '../../models/dtos/case-user-dto';
import { getCase } from '../../persistence/case';
import * as CaseUserPersistence from '../../persistence/case-user';
import { defaultProvider } from '../../persistence/schema/entities';
import { getUser } from '../../persistence/user';
import { NotFoundError } from '../exceptions/not-found-exception';

export const createCaseUserMembershipFromDTO = async (
  caseUserDto: CaseUserDTO,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<CaseUser> => {
  const user = await getUser(caseUserDto.userUlid, repositoryProvider);
  if (!user) {
    throw new NotFoundError(`User with ulid ${caseUserDto.userUlid} not found.`);
  }
  const deaCase = await getCase(caseUserDto.caseUlid, undefined, repositoryProvider);

  if (!deaCase) {
    throw new NotFoundError(`Case with ulid ${caseUserDto.caseUlid} not found.`);
  }

  const caseUser: CaseUser = {
    ...caseUserDto,
    userFirstName: user.firstName,
    userLastName: user.lastName,
    caseName: deaCase.name,
  };

  return await createCaseUserMembership(caseUser, repositoryProvider);
};

export const createCaseUserMembership = async (
  caseUser: CaseUser,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<CaseUser> => {
  return await CaseUserPersistence.createCaseUser(caseUser, repositoryProvider);
};

export const getCaseUsersForUser = async (
  userUlid: string,
  limit = 30,
  nextToken?: object,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<Paged<CaseUser>> => {
  return CaseUserPersistence.listCaseUsersByUser(userUlid, limit, nextToken, repositoryProvider);
};

export const deleteCaseUsersForCase = async (caseUlid: string, repositoryProvider = defaultProvider) => {
  let batch = {};
  const caseUsers = await CaseUserPersistence.listCaseUsersByCase(
    caseUlid,
    /* limit */ 25,
    undefined,
    repositoryProvider
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
      /* limit */ 25,
      next,
      repositoryProvider
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
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<void> => {
  await CaseUserPersistence.deleteCaseUser({ userUlid, caseUlid }, repositoryProvider);
};
