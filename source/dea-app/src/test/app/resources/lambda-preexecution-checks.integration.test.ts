/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Paged } from 'dynamodb-onetable';
import Joi from 'joi';
import { NotFoundError } from '../../../app/exceptions/not-found-exception';
import { ReauthenticationError } from '../../../app/exceptions/reauthentication-exception';
import { runPreExecutionChecks } from '../../../app/resources/dea-lambda-utils';
import { IdentityType } from '../../../app/services/audit-service';
import { createSession } from '../../../app/services/session-service';
import { createUser } from '../../../app/services/user-service';
import { getTokenPayload } from '../../../cognito-token-helpers';
import { Oauth2Token } from '../../../models/auth';
import { DeaUser } from '../../../models/user';
import { sessionResponseSchema } from '../../../models/validation/session';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { listSessionsForUser, updateSession } from '../../../persistence/session';
import { getUserByTokenId, listUsers } from '../../../persistence/user';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { testEnv } from '../../../test-e2e/helpers/settings';
import { randomSuffix } from '../../../test-e2e/resources/test-helpers';
import { dummyContext, getDummyAuditEvent, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;

describe('lambda pre-execution checks', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const suffix = randomSuffix();
  const testUser = `lambdaPreExecutionChecksTestUser${suffix}`;
  const firstName = 'PreExecCheck';
  const lastName = 'TestUser';
  const region = testEnv.awsRegion;

  beforeAll(async () => {
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    repositoryProvider = await getTestRepositoryProvider('lambdaPreExecutionChecksTest');
  }, 40000);

  afterAll(async () => {
    await cognitoHelper.cleanup(repositoryProvider);
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  }, 40000);

  it('should add first time federated user to dynamo table', async () => {
    const oauthToken = await cognitoHelper.getIdTokenForUser(testUser);

    const event = getDummyEvent();
    event.headers['cookie'] = `idToken=${JSON.stringify(oauthToken)}`;
    const tokenPayload = await getTokenPayload(oauthToken.id_token, region);
    const tokenId = tokenPayload.sub;

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
    expect(event.headers['tokenId']).toBeDefined();
    expect(event.headers['tokenId']).toStrictEqual(tokenPayload.origin_jti);

    // Mimic race condition of 2 APIs running pre-exec checks and trying
    // to create the user at the same time
    // Expect we get the original user back
    const duplicateUser = await createUser(
      {
        tokenId,
        firstName,
        lastName,
      },
      repositoryProvider
    );
    expect(duplicateUser.created).toBeDefined();
    expect(duplicateUser.created).toStrictEqual(user?.created);

    // Mark session revoked (mimic logout)
    // so we can test same user different idtoken
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sessions = await listSessionsForUser(user!.ulid, repositoryProvider);
    expect(sessions.length).toEqual(1);
    const session = sessions[0];
    await updateSession(
      {
        ...session,
        isRevoked: true,
      },
      repositoryProvider
    );

    // call again with a different token from the same user,
    // make sure not added twice (in the getByToken code, we assert only 1 exists)

    const result = await cognitoHelper.getIdTokenForUser(testUser);
    const idToken2 = result.id_token;
    const tokenId2 = (await getTokenPayload(idToken2, region)).sub;
    expect(tokenId2).toStrictEqual(tokenId);

    const event2 = getDummyEvent();
    event2.headers['cookie'] = `idToken=${JSON.stringify(result)}`;

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
  }, 40000);

  it('should throw if no cognitoId is included in the request', async () => {
    const event = getDummyEvent();

    event.requestContext.identity.cognitoIdentityId = null;

    const auditEvent = getDummyAuditEvent();

    // run the pre-checks
    await expect(runPreExecutionChecks(event, dummyContext, auditEvent, repositoryProvider)).rejects.toThrow(
      NotFoundError
    );
  }, 40000);

  it('should succeed if session meets requirements', async () => {
    // Create user
    const user = `SuccessSession${suffix}`;
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'Success', 'Session');
    const oauthToken = await cognitoHelper.getIdTokenForUser(user);

    // Call API expect success, adds session to db
    const userUlid = await callPreChecks(oauthToken);
    const sessions = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions.length).toEqual(1);
    const session1 = sessions[0];
    Joi.assert(session1, sessionResponseSchema);

    // Call API again with same creds, expect success
    await callPreChecks(oauthToken);
    const sessions2 = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions2.length).toEqual(1);
    const session2 = sessions2[0];
    expect(session2.updated).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(session2.updated!.getTime()).toBeGreaterThan(session1.updated!.getTime());
    expect(session2.created).toBeDefined();
    expect(session2.created).toStrictEqual(session1.created);

    // Now try to create the session again (mimic race condition)
    // should just return the original session
    const session3 = await createSession(
      {
        userUlid,
        tokenId: session1.tokenId,
      },
      repositoryProvider
    );
    expect(session3.created).toStrictEqual(session1.created);
  }, 40000);

  it('should require reauthentication if your session is revoked', async () => {
    // Create user
    const user = `RevokedSession${suffix}`;
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'Revoked', 'Session');
    const oauthToken = await cognitoHelper.getIdTokenForUser(user);

    // Call API, adds session to db
    const userUlid = await callPreChecks(oauthToken);
    const sessions = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions.length).toEqual(1);
    const session1 = sessions[0];

    // Mark session as revoked (mock the logout process)
    await updateSession(
      {
        ...session1,
        isRevoked: true,
      },
      repositoryProvider
    );

    // Call API again, expect failure
    await expect(callPreChecks(oauthToken)).rejects.toThrow(ReauthenticationError);

    // Create new session, call API, should succeed
    const newIdToken = await cognitoHelper.getIdTokenForUser(user);
    await callPreChecks(newIdToken);
  }, 40000);

  it('should require reauthentication if your session is expired', async () => {
    // Create user
    const user = `ExpiredSession${suffix}`;
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'Expired', 'Session');
    const oauthToken = await cognitoHelper.getIdTokenForUser(user);

    // Call API, adds session to db
    const userUlid = await callPreChecks(oauthToken);
    const sessions = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions.length).toEqual(1);
    const session1 = sessions[0];

    // Change session ttl (mocks the session expiring)
    await updateSession(
      {
        ...session1,
        ttl: Date.now() / 1000 - 5, // expired 5 seconds ago
      },
      repositoryProvider
    );

    // Call API again, expect failure
    await expect(callPreChecks(oauthToken)).rejects.toThrow(ReauthenticationError);

    // Create new session, call API, should succeed
    const newIdToken = await cognitoHelper.getIdTokenForUser(user);
    await callPreChecks(newIdToken);
  }, 40000);
});

const callPreChecks = async (oauthToken: Oauth2Token): Promise<string> => {
  const event = getDummyEvent();
  event.headers['cookie'] = `idToken=${JSON.stringify(oauthToken)}`;
  const auditEvent = getDummyAuditEvent();

  // Call API expect success
  await runPreExecutionChecks(event, dummyContext, auditEvent, repositoryProvider);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return event.headers['userUlid']!;
};
