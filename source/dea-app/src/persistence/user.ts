/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { userFromEntity } from '../models/projections';
import { DeaUser } from '../models/user';
import { isDefined } from './persistence-helpers';
import { UserModel, UserModelRepositoryProvider } from './schema/entities';

export const getUser = async (
    ulid: string,
    repositoryProvider: UserModelRepositoryProvider = {
        UserModel: UserModel,
    }
): Promise<DeaUser | undefined> => {
    const userEntity = await repositoryProvider.UserModel.get({
        PK: `USER#${ulid}#`,
        SK: `USER#`,
    });

    return userFromEntity(userEntity);
};

export const listUsers = async (
    limit = 30,
    nextToken?: object,
    repositoryProvider: UserModelRepositoryProvider = { UserModel: UserModel }
): Promise<Paged<DeaUser>> => {
    const caseEntities = await repositoryProvider.UserModel.find(
        {
            GSI1PK: 'USER#',
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

    const users: Paged<DeaUser> = caseEntities.map((entity) => userFromEntity(entity)).filter(isDefined);
    users.count = caseEntities.count;
    users.next = caseEntities.next;
    //undefined because I have a concern about travelling backwards to negative page numbers (due to new records)
    users.prev = undefined;

    return users;
};

export const createUser = async (
    deaUser: DeaUser,
    repositoryProvider: UserModelRepositoryProvider = {
        UserModel: UserModel,
    }
): Promise<DeaUser | undefined> => {
    const newEntity = await repositoryProvider.UserModel.create(
        {
            ...deaUser,
            lowerFirstName: deaUser.firstName.toLowerCase(),
            lowerLastName: deaUser.lastName.toLowerCase(),
        },
    );

    return userFromEntity(newEntity);
};

export const updateUser = async (
    deaUser: DeaUser,
    repositoryProvider: UserModelRepositoryProvider = {
        UserModel: UserModel,
    }
): Promise<DeaUser | undefined> => {
    const newEntity = await repositoryProvider.UserModel.update(
        {
            ...deaUser,
            lowerFirstName: deaUser.firstName.toLowerCase(),
            lowerLastName: deaUser.lastName.toLowerCase(),
        },
    );

    return userFromEntity(newEntity);
};

export const deleteUser = async (
    ulid: string,
    repositoryProvider: UserModelRepositoryProvider = {
        UserModel: UserModel,
    }
): Promise<void> => {
    await repositoryProvider.UserModel.remove({
        PK: `USER#${ulid}#`,
        SK: `USER#`,
    });
}
