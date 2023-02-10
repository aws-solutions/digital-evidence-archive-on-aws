/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { getUsers } from '../../../app/resources/get-users';
import { createUser } from '../../../app/services/user-service';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { dummyContext, dummyEvent } from '../../integration-objects';
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
        firstName: 'Create',
        lastName: 'One',
      },
      repositoryProvider
    );

    const user2 = await createUser(
      {
        tokenId: 'creator2',
        firstName: 'Create',
        lastName: 'Two',
      },
      repositoryProvider
    );

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        queryStringParameters: {
          limit: '1',
        },
      }
    );
    const response = await getUsers(event, dummyContext, repositoryProvider);

    if (!response.body) {
      fail();
    }

    const casesPage: ResponseUserPage = JSON.parse(response.body);
    expect(casesPage.users.length).toEqual(1);
    expect(casesPage.next).toBeTruthy();

    const event2 = Object.assign(
      {},
      {
        ...dummyEvent,
        queryStringParameters: {
          next: casesPage.next,
        },
      }
    );
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
});
