/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { createSession, getSession, listSessionsForUser, updateSession } from '../../persistence/session';
import { createUser } from '../../persistence/user';
import { getTestRepositoryProvider } from './local-db-table';

describe('session persistence', () => {
  let repositoryProvider: ModelRepositoryProvider;
  let userUlid: string;
  let otherUserUlid: string;
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('sessionTestsTable');

    userUlid = (
      await createUser(
        {
          tokenId: 'jinnycraft',
          firstName: 'Jinny',
          lastName: 'Craft',
        },
        repositoryProvider
      )
    ).ulid;

    otherUserUlid = (
      await createUser(
        {
          tokenId: 'jimjenson',
          firstName: 'Jim',
          lastName: 'Jenson',
        },
        repositoryProvider
      )
    ).ulid;
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should create a session', async () => {
    // Create session
    const tokenId = 'CREATE_SESSION_TEST';
    const result = await createSession(
      {
        userUlid,
        tokenId,
      },
      repositoryProvider
    );

    // call ListSessionsForUser, Expect there is only 1 and it matches the
    // session we created
    const sessions = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions.length).toEqual(1);
    // Now query for that session specifically
    const maybeSession = await getSession(userUlid, tokenId, repositoryProvider);
    expect(maybeSession).toBeDefined();
    //eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const session = maybeSession!;
    expect(session.userUlid).toStrictEqual(userUlid);
    expect(session.tokenId).toStrictEqual(tokenId);
    expect(session.isRevoked).toBeFalsy();
    expect(session.created).toBeDefined();
    expect(session.created).toStrictEqual(session.updated);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(session.created!.getTime()).toBeLessThan(new Date().getTime());
    // Check that the TTL was set to an hour from now
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(session.ttl).toBe(Math.floor(session.created!.getTime() / 1000) + 3600);
    expect(session).toStrictEqual(result);
  });

  it('should return empty when there are no sessions for a user', async () => {
    // Create a user
    const testUserUlid = (
      await createUser(
        {
          tokenId: 'jenraft',
          firstName: 'Jen',
          lastName: 'Raft',
        },
        repositoryProvider
      )
    ).ulid;

    const tokenId = 'EMPTY_SESSION_TEST';
    // Create sessions for another user
    await createSession(
      {
        userUlid: otherUserUlid,
        tokenId: `${tokenId}_1`,
      },
      repositoryProvider
    );

    await createSession(
      {
        userUlid: otherUserUlid,
        tokenId: `${tokenId}_2`,
      },
      repositoryProvider
    );

    const sessions = await listSessionsForUser(testUserUlid, repositoryProvider);
    expect(sessions.length).toEqual(0);
  });

  it('should update a session', async () => {
    // Create user
    const tokenId = 'UPDATE_SESSION_TEST';
    const testUserUlid = (
      await createUser(
        {
          tokenId: 'raftpaxos',
          firstName: 'Raft',
          lastName: 'Paxos',
        },
        repositoryProvider
      )
    ).ulid;

    // Create session for user
    const session = await createSession(
      {
        userUlid: testUserUlid,
        tokenId,
      },
      repositoryProvider
    );
    expect(session.isRevoked).toBeFalsy();

    // Update Session
    await updateSession(
      {
        ...session,
        isRevoked: true,
      },
      repositoryProvider
    );

    // Check that updated session is returned, and the updated time field changed
    const updatedSessions = await listSessionsForUser(testUserUlid, repositoryProvider);
    expect(updatedSessions.length).toEqual(1);
    const updatedSession = updatedSessions[0];
    expect(updatedSession.userUlid).toStrictEqual(session.userUlid);
    expect(updatedSession.tokenId).toStrictEqual(session.tokenId);
    expect(updatedSession.ttl).toEqual(session.ttl);
    expect(updatedSession.created).toBeDefined();
    expect(updatedSession.created).toEqual(session.created);
    expect(updatedSession.isRevoked).toBeTruthy();
    expect(updatedSession.updated).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updatedSession.updated!.getTime()).toBeGreaterThan(session.updated!.getTime());
  });

  it('should return all sessions for a user, and only their sessions', async () => {
    // Create sessions for other users
    await createSession(
      {
        userUlid: otherUserUlid,
        tokenId: `LISTSESSIONSTEST_OTHER_1`,
      },
      repositoryProvider
    );
    await createSession(
      {
        userUlid,
        tokenId: `LISTSESSIONSTEST_OTHER_2`,
      },
      repositoryProvider
    );

    // Create user
    const tokenId = 'LISTSESSIONSTEST';
    const testUserUlid = (
      await createUser(
        {
          tokenId: 'Papayafruit',
          firstName: 'Papaya',
          lastName: 'Fruit',
        },
        repositoryProvider
      )
    ).ulid;

    // Create sessions for user
    const numSessions = 3;
    for (let i = 0; i < numSessions; i++) {
      await createSession(
        {
          userUlid: testUserUlid,
          tokenId: `${tokenId}_${i}`,
        },
        repositoryProvider
      );
    }

    // Call list sessions and check they are all returned, only those for
    // the user are returned
    const sessions = await listSessionsForUser(testUserUlid, repositoryProvider);
    expect(sessions.length).toEqual(numSessions);
    expect(sessions.filter((session) => session.userUlid == testUserUlid).length).toBe(numSessions);
  });

  it('should update a session even if the update is empty', async () => {
    // Create user
    const tokenId = 'EMPTY_UPDATE_TEST';
    const testUserUlid = (
      await createUser(
        {
          tokenId: 'emptyupdate',
          firstName: 'Empty',
          lastName: 'Update',
        },
        repositoryProvider
      )
    ).ulid;

    // Create session for user
    const session = await createSession(
      {
        userUlid: testUserUlid,
        tokenId,
      },
      repositoryProvider
    );

    // Update Session
    await updateSession(
      {
        ...session,
      },
      repositoryProvider
    );

    // Check that updated session is returned, and the updated time field changed
    const updatedSessions = await listSessionsForUser(testUserUlid, repositoryProvider);
    expect(updatedSessions.length).toEqual(1);
    const updatedSession = updatedSessions[0];
    expect(updatedSession.created).toBeDefined();
    expect(updatedSession.created).toEqual(session.created);
    expect(updatedSession.updated).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(updatedSession.updated!.getTime()).toBeGreaterThan(session.updated!.getTime());
  });
});
