/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { runPreExecutionChecks } from '../../../app/resources/dea-lambda-utils';
import { getTokenPayload } from '../../../cognito-token-helpers';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { getUserByTokenId, listUsers } from '../../../persistence/user';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { envSettings } from '../../../test-e2e/helpers/settings';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

describe('lambda pre-execution checks', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'lambdaPreExecutionChecksTestUser';
  const firstName = 'PreExecCheck';
  const lastName = 'TestUser';
  const region = envSettings.awsRegion;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    repositoryProvider = await getTestRepositoryProvider('lambdaPreExecutionChecksTest');
  });

  afterAll(async () => {
    await cognitoHelper.cleanup(repositoryProvider);
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should add first time federated user to dynamo table', async () => {
    const idToken = await cognitoHelper.getIdTokenForUser(testUser);

    const tokenId = (await getTokenPayload(idToken, region)).sub;
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
      }
    );
    event.headers['idToken'] = idToken;

    // Check user with token is NOT in DB (e.g. first-time federation)
    expect(await getUserByTokenId(tokenId, repositoryProvider)).toBeUndefined();

    // run the pre-checks
    await runPreExecutionChecks(event, dummyContext, repositoryProvider);

    // user should have been added to the DB
    const user = await getUserByTokenId(tokenId, repositoryProvider);
    expect(user).toBeDefined();
    expect(user?.tokenId).toBe(tokenId);
    expect(user?.firstName).toStrictEqual(firstName);
    expect(user?.lastName).toStrictEqual(lastName);
    // check that the event contains the ulid from the new user
    expect(event.headers['userUlid']).toBeDefined();
    expect(event.headers['userUlid']).toStrictEqual(user?.ulid);

    // clear the event headers so they are not present for the
    // next set of checks for an existing user
    delete event.headers['userUlid'];
    delete event.headers['idToken'];

    // call again with a different token from the same user,
    // make sure not added twice (in the getByToken code, we assert only 1 exists)

    const idToken2 = await cognitoHelper.getIdTokenForUser(testUser);
    const tokenId2 = await (await getTokenPayload(idToken, region)).sub;
    expect(tokenId2).toStrictEqual(tokenId);

    const event2 = Object.assign(
      {},
      {
        ...dummyEvent,
      }
    );
    event2.headers['idToken'] = idToken2;
    await runPreExecutionChecks(event2, dummyContext, repositoryProvider);

    const user2 = await getUserByTokenId(tokenId2, repositoryProvider);
    expect(user2).toBeDefined();
    expect(user2?.ulid).toStrictEqual(user?.ulid);
    expect(user2?.tokenId).toStrictEqual(tokenId);
    expect(user2?.created).toStrictEqual(user?.created);
    // check that the event contains the ulid from the new user
    expect(event2.headers['userUlid']).toBeDefined();
    expect(event2.headers['userUlid']).toStrictEqual(user2?.ulid);

    // clear the event headers so they do not show up in other tests
    delete event2.headers['userUlid'];
    delete event2.headers['idToken'];

    // Check only user is in the db:
    const users: Paged<DeaUser> = await listUsers(/*limit=*/ 100, /*next=*/ undefined, repositoryProvider);
    expect(users.length).toBe(1);
    expect(users[0].tokenId).toStrictEqual(tokenId);
    expect(users[0].ulid).toStrictEqual(user2?.ulid);
  });

  it('should log successful and unsuccessful logins/api invocations', () => {
    /* TODO */
  });

  it('should disallow concurrent active session', () => {
    /* TODO */
    // check after first session has been invalidated, you cannot use the credentials again
  });

  it('should require reauthentication about 30 minutes of inactivity', () => {
    /* TODO */
  });
});
