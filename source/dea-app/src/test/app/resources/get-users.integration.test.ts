/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import Joi from 'joi';
import { getUsers } from '../../../app/resources/get-users';
import { createUser } from '../../../app/services/user-service';
import { DeaUser } from '../../../models/user';
import { userResponseSchema } from '../../../models/validation/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

type ResponseUserPage = {
  users: DeaUser[];
  next: string | undefined;
};

describe('get users resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getUsersTest');
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should fetch users across pages', async () => {
    const user1 = await createUser(
      {
        tokenId: 'creator1',
        idPoolId: 'creator1identityid',
        firstName: 'Create',
        lastName: 'One',
      },
      repositoryProvider
    );

    const user2 = await createUser(
      {
        tokenId: 'creator2',
        idPoolId: 'creator2identityid',
        firstName: 'Create',
        lastName: 'Two',
      },
      repositoryProvider
    );

    const event = getDummyEvent({
      queryStringParameters: {
        limit: '1',
      },
    });
    const response = await getUsers(event, dummyContext, repositoryProvider);

    if (!response.body) {
      fail();
    }

    const casesPage: ResponseUserPage = JSON.parse(response.body);
    expect(casesPage.users.length).toEqual(1);
    expect(casesPage.next).toBeTruthy();
    expect(casesPage.users[0].idPoolId).toBeUndefined();
    expect(casesPage.users[0].tokenId).toBeUndefined();
    Joi.assert(casesPage.users[0], userResponseSchema);
    const event2 = getDummyEvent({
      queryStringParameters: {
        next: casesPage.next,
      },
    });
    const response2 = await getUsers(event2, dummyContext, repositoryProvider);
    if (!response2.body) {
      fail();
    }
    const casesPage2: ResponseUserPage = JSON.parse(response2.body);
    expect(casesPage2.users.length).toEqual(1);
    expect(casesPage2.next).toBeFalsy();

    const allUsers = casesPage.users.concat(casesPage2.users);
    expect(allUsers.find((deauser) => deauser.lastName === user1.lastName)).toBeDefined();
    expect(allUsers.find((deauser) => deauser.lastName === user2.lastName)).toBeDefined();
  });

  it('should fetch records beginning with a pattern', async () => {
    const user1 = await createUser(
      {
        tokenId: 'FNameAOStartingname',
        idPoolId: 'FNameAOStartingnameidentityid',
        firstName: 'FNameA',
        lastName: 'OStartingname',
      },
      repositoryProvider
    );

    const user2 = await createUser(
      {
        tokenId: 'FNameALstartingname',
        idPoolId: 'FNameALstartingnameidentityid',
        firstName: 'FNameA',
        lastName: 'Lstartingname',
      },
      repositoryProvider
    );

    await createUser(
      {
        tokenId: 'ShirleyRodriguez',
        idPoolId: 'ShirleyRodriguezidentityid',
        firstName: 'Shirley',
        lastName: 'Rodriguez',
      },
      repositoryProvider
    );

    const event = getDummyEvent({
      queryStringParameters: {
        nameBeginsWith: 'FNameA',
      },
    });
    const response = await getUsers(event, dummyContext, repositoryProvider);

    if (!response.body) {
      fail();
    }

    const casesPage: ResponseUserPage = JSON.parse(response.body);
    expect(casesPage.users.length).toEqual(2);
    expect(casesPage.next).toBeFalsy();

    expect(casesPage.users.find((user) => user.firstName === user1.firstName)).toBeDefined();
    expect(casesPage.users.find((user) => user.firstName === user2.firstName)).toBeDefined();
  });
});
