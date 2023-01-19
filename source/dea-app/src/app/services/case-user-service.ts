/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from "dynamodb-onetable";
import { CaseUser } from "../../models/case-user";
import { CaseUserDTO } from "../../models/dtos/case-user-dto";
import { getCase } from "../../persistence/case";
import * as CaseUserPersistence from "../../persistence/case-user";
import { defaultProvider } from "../../persistence/schema/entities";
import { getUser } from "../../persistence/user";
import { NotFoundError } from "../exceptions/not-found-exception";

export const createCaseUserMembershipFromDTO = async (caseUserDto: CaseUserDTO, repositoryProvider = defaultProvider): Promise<CaseUser> => {
    const user = await getUser(caseUserDto.userUlid, repositoryProvider);
    if (!user) {
        throw new NotFoundError(`User with ulid ${caseUserDto.userUlid} not found.`);
    }
    const deaCase = await getCase(caseUserDto.caseUlid, repositoryProvider);
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
}

export const createCaseUserMembership = async (caseUser: CaseUser, repositoryProvider = defaultProvider): Promise<CaseUser> => {
    return await CaseUserPersistence.createCaseUser(caseUser, repositoryProvider);
}

export const getCaseUsersForUser = async (
    userUlid: string,
    limit = 30,
    nextToken?: object,
    repositoryProvider = defaultProvider,
): Promise<Paged<CaseUser>> => {
    return CaseUserPersistence.listCaseUsersByUser(userUlid, limit, nextToken, repositoryProvider);
}
