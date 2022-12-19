/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { logger } from '../logger';
import { CaseUser } from '../models/case-user';
import { caseUserFromEntity } from '../models/projections';
import { isDefined } from './persistence-helpers';
import { CaseUserModel, CaseUserModelRepositoryProvider } from './schema/entities';

export const getCaseUser = async ( 
    caseUserIds: {
        caseUlid: string,
        userUlid: string,
    },
    repositoryProvider: CaseUserModelRepositoryProvider = {
        CaseUserModel: CaseUserModel,
    }
): Promise<CaseUser | undefined> => {
    const caseUserEntity = await repositoryProvider.CaseUserModel.get({
        PK: `USER#${caseUserIds.userUlid}#`,
        SK: `CASE#${caseUserIds.caseUlid}#`,
    });

    return caseUserFromEntity(caseUserEntity);
};

export const listCaseUsersByCase = async (
    caseUlid: string,
    limit = 30,
    nextToken?: object,
    repositoryProvider: CaseUserModelRepositoryProvider = { CaseUserModel: CaseUserModel }
): Promise<Paged<CaseUser>> => {
    const caseEntities = await repositoryProvider.CaseUserModel.find(
        {
            GSI1PK: `CASE#${caseUlid}`,
            GSI1SK: {
                begins_with: 'USER#',
            },
        },
        {
            next: nextToken,
            limit,
            index: 'GSI1',
        }
    );

    const caseUsers: Paged<CaseUser> = caseEntities.map((entity) => caseUserFromEntity(entity)).filter(isDefined);
    caseUsers.count = caseEntities.count;
    caseUsers.next = caseEntities.next;
    //undefined because I have a concern about travelling backwards to negative page numbers (due to new records)
    caseUsers.prev = undefined;

    return caseUsers;
};

export const listCaseUsersByUser = async (
    userUlid: string,
    limit = 30,
    nextToken?: object,
    repositoryProvider: CaseUserModelRepositoryProvider = { CaseUserModel: CaseUserModel }
): Promise<Paged<CaseUser>> => {
    const caseEntities = await repositoryProvider.CaseUserModel.find(
        {
            GSI1PK: `USER#${userUlid}`,
            GSI1SK: {
                begins_with: 'CASE#',
            },
        },
        {
            next: nextToken,
            limit,
            index: 'GSI2',
        }
    );

    const caseUsers: Paged<CaseUser> = caseEntities.map((entity) => caseUserFromEntity(entity)).filter(isDefined);
    caseUsers.count = caseEntities.count;
    caseUsers.next = caseEntities.next;
    //undefined because I have a concern about travelling backwards to negative page numbers (due to new records)
    caseUsers.prev = undefined;

    return caseUsers;
};

export const createCaseUser = async (
    caseUser: CaseUser,
    repositoryProvider: CaseUserModelRepositoryProvider = {
        CaseUserModel: CaseUserModel,
    }
): Promise<CaseUser> => {
    const newEntity = await repositoryProvider.CaseUserModel.create(
        {
            ...caseUser,
            userFirstNameLower: caseUser.userFirstName.toLowerCase(),
            userLastNameLower: caseUser.userLastName.toLowerCase(),
        },
    );

    const newCaseUser = caseUserFromEntity(newEntity);
    if (!newCaseUser) {
        logger.error('CaseUser creation failed', {caseUser: JSON.stringify(caseUser)});
        throw new Error('Case creation failed');
    }
    return newCaseUser;
};

export const updateCaseUser = async (
    caseUser: CaseUser,
    repositoryProvider: CaseUserModelRepositoryProvider = {
        CaseUserModel: CaseUserModel,
    }
): Promise<CaseUser | undefined> => {
    const newEntity = await repositoryProvider.CaseUserModel.update(
        {
            ...caseUser,
            userFirstNameLower: caseUser.userFirstName.toLowerCase(),
            userLastNameLower: caseUser.userLastName.toLowerCase(),
        },
    );

    return caseUserFromEntity(newEntity);
};