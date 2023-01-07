/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from "dynamodb-onetable";
import { CaseUser } from "../../models/case-user";
import { CaseUserDTO } from "../../models/dtos/case-user-dto";
import { getCase } from "../../persistence/case";
import * as CaseUserPersistence from "../../persistence/case-user";
import { getUser } from "../../persistence/user";
import { NotFoundError } from "../exceptions/not-found-exception";

export const createCaseUserMembershipFromDTO = async (caseUserDto: CaseUserDTO): Promise<CaseUser> => {
    const user = await getUser(caseUserDto.userUlid);
    if (!user) {
        throw new NotFoundError(`User with ulid ${caseUserDto.userUlid} not found.`);
    }
    const deaCase = await getCase(caseUserDto.caseUlid);
    if (!deaCase) {
        throw new NotFoundError(`Case with ulid ${caseUserDto.caseUlid} not found.`);
    }

    const caseUser: CaseUser = {
        ...caseUserDto,
        userFirstName: user.firstName,
        userLastName: user.lastName,
        caseName: deaCase.name,
    };

    return await createCaseUserMembership(caseUser);
}

export const createCaseUserMembership = async (caseUser: CaseUser): Promise<CaseUser> => {
    return await CaseUserPersistence.createCaseUser(caseUser);
}

export const getCaseUsersForUser = async (
    userUlid: string,
    limit = 30,
    nextToken?: object,
): Promise<Paged<CaseUser>> => {
    return CaseUserPersistence.listCaseUsersByUser(userUlid, limit, nextToken);
}
