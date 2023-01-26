/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCase } from '../models/case';
import { CaseType, CaseUserType, UserType } from '../persistence/schema/entities';
import { CaseAction } from './case-action';
import { CaseStatus } from './case-status';
import { CaseUser } from './case-user';
import { DeaUser } from './user';

export const caseFromEntity = (caseEntity: CaseType): DeaCase => {
  return {
    ulid: caseEntity.ulid,
    name: caseEntity.name,
    description: caseEntity.description,
    objectCount: caseEntity.objectCount,
    // status schema is defined with CaseStatus so we can safely cast here
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    status: caseEntity.status as CaseStatus,
    created: caseEntity.created,
    updated: caseEntity.updated,
  };
};

export const userFromEntity = (userEntity: UserType): DeaUser => {
  return {
    ulid: userEntity.ulid,
    tokenId: userEntity.tokenId,
    firstName: userEntity.firstName,
    lastName: userEntity.lastName,
    created: userEntity.created,
    updated: userEntity.updated,
  };
};

export const caseUserFromEntity = (caseUserEntity: CaseUserType): CaseUser => {
  return {
    caseUlid: caseUserEntity.caseUlid,
    userUlid: caseUserEntity.userUlid,
    userFirstName: caseUserEntity.userFirstName,
    userLastName: caseUserEntity.userLastName,
    caseName: caseUserEntity.caseName,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    actions: caseUserEntity.actions?.map((action) => action as CaseAction) ?? [],
    created: caseUserEntity.created,
    updated: caseUserEntity.updated,
  };
};
