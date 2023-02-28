/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { runPreExecutionChecks } from '../../../app/resources/dea-lambda-utils';
import { IdentityType } from '../../../app/services/audit-service';
import { getTokenPayload } from '../../../cognito-token-helpers';
import { DeaUser } from '../../../models/user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { getUserByTokenId, listUsers } from '../../../persistence/user';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { testEnv } from '../../../test-e2e/helpers/settings';
import { dummyContext, dummyEvent, getDummyAuditEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

describe('lambda pre-execution checks', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'lambdaPreExecutionChecksTestUser';
  const firstName = 'PreExecCheck';
  const lastName = 'TestUser';
  const region = testEnv.awsRegion;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    repositoryProvider = await getTestRepositoryProvider('lambdaPreExecutionChecksTest');
  }, 10000);

  afterAll(async () => {
    await cognitoHelper.cleanup(repositoryProvider);
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  }, 10000);

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

    const auditEvent = getDummyAuditEvent();

    // Check user with token is NOT in DB (e.g. first-time federation)
    expect(await getUserByTokenId(tokenId, repositoryProvider)).toBeUndefined();

    // run the pre-checks
    await runPreExecutionChecks(event, dummyContext, auditEvent, repositoryProvider);

    expect(auditEvent.actorIdentity.idType).toEqual(IdentityType.FULL_USER_ID);

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
    const tokenId2 = (await getTokenPayload(idToken, region)).sub;
    expect(tokenId2).toStrictEqual(tokenId);

    const event2 = Object.assign(
      {},
      {
        ...dummyEvent,
      }
    );
    event2.headers['idToken'] = idToken2;

    const auditEvent2 = getDummyAuditEvent();
    await runPreExecutionChecks(event2, dummyContext, auditEvent2, repositoryProvider);

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
    const users: Paged<DeaUser> = await listUsers(
      /*limit=*/ 100,
      /*next=*/ undefined,
      /*nameBeginsWith=*/ undefined,
      repositoryProvider
    );
    expect(users.length).toBe(1);
    expect(users[0].tokenId).toStrictEqual(tokenId);
    expect(users[0].ulid).toStrictEqual(user2?.ulid);
  }, 10000);

  it('should throw if no cognitoId is included in the request', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
      }
    );

    event.requestContext.identity.cognitoIdentityId = null;

    const auditEvent = getDummyAuditEvent();

    // run the pre-checks
    await expect(runPreExecutionChecks(event, dummyContext, auditEvent, repositoryProvider)).rejects.toThrow(
      NotFoundError
    );
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
