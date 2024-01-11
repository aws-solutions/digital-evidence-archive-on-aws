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
import { useRefreshToken } from '../../../app/services/auth-service';
import { createSession, shouldSessionBeConsideredInactive } from '../../../app/services/session-service';
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
import {
  dummyContext,
  getDummyAuditEvent,
  getDummyEvent,
  setUserArnWithRole,
} from '../../integration-objects';
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
    setUserArnWithRole(event, /*roleName=*/ 'CaseWorker');
    event.headers['cookie'] = `extraCookie=someval; idToken=${JSON.stringify({
      id_token: oauthToken.id_token,
      expires_in: oauthToken.expires_in,
    })}; refreshToken=${JSON.stringify({ refresh_token: oauthToken.refresh_token })}`;
    const tokenPayload = await getTokenPayload(oauthToken.id_token, region);
    const tokenId = tokenPayload.sub;
    const idPoolId = event.requestContext.identity.cognitoIdentityId ?? 'us-east-1:1-2-3-a-b-c';

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
    expect(user?.idPoolId).toStrictEqual(idPoolId);
    expect(user?.firstName).toStrictEqual(firstName);
    expect(user?.lastName).toStrictEqual(lastName);
    // Expect that the DEA Role was parsed from the userArn of the Identity Pool credentials
    expect(event.headers['deaRole']).toBeDefined();
    expect(event.headers['deaRole']).toStrictEqual('CaseWorker');
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
        idPoolId,
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
    setUserArnWithRole(event2, /*roleName=*/ 'WorkingManager');
    event2.headers['cookie'] = `idToken=${JSON.stringify({
      id_token: result.id_token,
      expires_in: result.expires_in,
    })};refreshToken=${JSON.stringify({ refresh_token: result.refresh_token })}`;

    const auditEvent2 = getDummyAuditEvent();
    await runPreExecutionChecks(event2, dummyContext, auditEvent2, repositoryProvider);

    // Expect that the DEA Role was parsed from the userArn of the Identity Pool credentials
    expect(event2.headers['deaRole']).toBeDefined();
    expect(event2.headers['deaRole']).toStrictEqual('WorkingManager');

    const user2 = await getUserByTokenId(tokenId2, repositoryProvider);
    expect(user2).toBeDefined();
    expect(user2?.ulid).toStrictEqual(user?.ulid);
    expect(user2?.tokenId).toStrictEqual(tokenId);
    expect(user2?.idPoolId).toStrictEqual(idPoolId);
    expect(user2?.created).toStrictEqual(user?.created);
    // check that the event contains the ulid from the new user
    expect(event2.headers['userUlid']).toBeDefined();
    expect(event2.headers['userUlid']).toStrictEqual(user2?.ulid);

    // Check only user is in the db:
    const users: Paged<DeaUser> = await listUsers(
      /*nameBeginsWith=*/ undefined,
      repositoryProvider,
      /*next=*/ undefined,
      /*limit=*/ 100
    );
    expect(users.length).toBe(1);
    expect(users[0].tokenId).toStrictEqual(tokenId);
    expect(users[0].ulid).toStrictEqual(user2?.ulid);
  }, 40000);

  it('should throw if no cognitoId is included in the request', async () => {
    const event = getDummyEvent();
    setUserArnWithRole(event, /*roleName=*/ 'WorkingManager');

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
    const idPoolId = `successsession${suffix}`;

    // Call API expect success, adds session to db
    const userUlid = await callPreChecks(oauthToken, idPoolId);
    const sessions = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions.length).toEqual(1);
    const session1 = sessions[0];
    Joi.assert(session1, sessionResponseSchema);

    // Call API again with same creds, expect success
    await callPreChecks(oauthToken, idPoolId);
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
    const idPoolId = `revokedsession${suffix}`;

    // Call API, adds session to db
    const userUlid = await callPreChecks(oauthToken, idPoolId);
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
    await expect(callPreChecks(oauthToken, idPoolId)).rejects.toThrow(ReauthenticationError);

    // Create new session, call API, should succeed
    const newIdToken = await cognitoHelper.getIdTokenForUser(user);
    await callPreChecks(newIdToken, idPoolId);
  }, 40000);

  it('should require reauthentication if your session is expired', async () => {
    // Create user
    const user = `ExpiredSession${suffix}`;
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'Expired', 'Session');
    const oauthToken = await cognitoHelper.getIdTokenForUser(user);
    const idPoolId = `expiredsession${suffix}`;

    // Call API, adds session to db
    const userUlid = await callPreChecks(oauthToken, idPoolId);
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
    await expect(callPreChecks(oauthToken, idPoolId)).rejects.toThrow(ReauthenticationError);

    // Create new session, call API, should succeed
    const newIdToken = await cognitoHelper.getIdTokenForUser(user);
    await callPreChecks(newIdToken, idPoolId);
  }, 40000);

  it('should require reauthentication if your session was last active 30+ minutes ago', async () => {
    // Create user
    const user = `InactiveSession${suffix}`;
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'Inactive', 'Session');
    const oauthToken = await cognitoHelper.getIdTokenForUser(user);
    const idPoolId = `inactivesession${suffix}`;

    // Call API, adds session to db
    const userUlid = await callPreChecks(oauthToken, idPoolId);
    const sessions = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions.length).toEqual(1);
    const session = sessions[0];

    // We cannot mock time without the SSM SDK also breaking, so we
    // will just test the shouldSessionBeConsideredInactive
    jest.useFakeTimers();
    // Mock session timeout by forcing Date.now() to adding 30+ minutes to the value
    jest.setSystemTime(Date.now() + 18000001);
    expect(shouldSessionBeConsideredInactive(session)).toBeTruthy();
    jest.useRealTimers();
  }, 40000);

  it('should revoke all previous sessions for a user when they log in with a new session.', async () => {
    // Create user
    const user = `ConcurrentSession${suffix}`;
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'Concurrent', 'Session');
    const oauthToken = await cognitoHelper.getIdTokenForUser(user);
    const idPoolId = `concurrentsession${suffix}`;

    // Call API, adds session to db
    const userUlid = await callPreChecks(oauthToken, idPoolId);
    const sessions = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions.length).toEqual(1);

    // Create another session, call API, it should succeed and revoke old session
    const newIdToken = await cognitoHelper.getIdTokenForUser(user);
    await callPreChecks(newIdToken, idPoolId);

    // There should be 2 sessions for the user now
    // The old one which is revoked, and the new session
    const sessions2 = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions2.length).toEqual(2);
    const newSession = sessions2.filter((session) => !session.isRevoked);
    expect(newSession.length).toBe(1);

    // Try old session, it should fail
    await expect(callPreChecks(oauthToken, idPoolId)).rejects.toThrow(ReauthenticationError);

    // Get new id token with old refresh token, call API with new id token, it should fail
    // since old session with origin_jti was revoked
    const [newIdTokenForOldSession] = await useRefreshToken(oauthToken.refresh_token);
    await expect(callPreChecks(newIdTokenForOldSession, idPoolId)).rejects.toThrow(ReauthenticationError);

    // Try new session again it should succeed.
    await callPreChecks(newIdToken, idPoolId);

    // There should still only be 2 sessions
    const sessions3 = await listSessionsForUser(userUlid, repositoryProvider);
    expect(sessions3.length).toEqual(2);
  }, 40000);

  it('should fail id the identityid from event does not match whats in the DB for the user', async () => {
    // Create user
    const user = `MismatchedCreds${suffix}`;
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'Mismatched', 'Creds');
    const oauthToken = await cognitoHelper.getIdTokenForUser(user);
    const idPoolId = `mismatchedcredsidpoolid${suffix}`;

    // Call API, adds user to db with the identity id
    await callPreChecks(oauthToken, idPoolId);

    // Call API again with different identity id this time, expect failure
    await expect(callPreChecks(oauthToken, 'BAD_IDENTITY_ID')).rejects.toThrow(ReauthenticationError);

    // Call API with correct identity id, call API, should succeed
    await callPreChecks(oauthToken, idPoolId);
  }, 40000);

  it('should update user identity id in DB if it is not present', async () => {
    // Create user
    const user = `NoIdentityPoolId${suffix}`;
    await cognitoHelper.createUser(user, 'AuthTestGroup', 'NoIdentityPool', 'PoolId');
    const oauthToken = await cognitoHelper.getIdTokenForUser(user);
    const tokenPayload = await getTokenPayload(oauthToken.id_token, region);
    const tokenId = tokenPayload.sub;
    const endIdPoolId = `oldusernowupdatesidpoolid${suffix}`;

    // Add user to db without id pool id
    const newDeaUser = {
      tokenId,
      firstName: 'NoIdentityPool',
      lastName: 'PoolId',
    };
    await createUser(newDeaUser, repositoryProvider);

    // Check that the Identity Id is not set (mimicking a user being added before
    // we required the idPoolId in the db)
    const deaUser = await getUserByTokenId(tokenId, repositoryProvider);
    expect(deaUser?.idPoolId).toBeUndefined();

    // Call API again, then check that the identity id was added in
    await callPreChecks(oauthToken, endIdPoolId);
    const userWithIdPoolId = await getUserByTokenId(tokenId, repositoryProvider);
    expect(userWithIdPoolId).toBeDefined();
    expect(userWithIdPoolId?.idPoolId).toStrictEqual(endIdPoolId);
  }, 40000);
});

const callPreChecks = async (oauthToken: Oauth2Token, idPoolId?: string): Promise<string> => {
  const event = getDummyEvent();
  setUserArnWithRole(event, /*roleName=*/ 'CaseWorker');
  event.headers['cookie'] = `idToken=${JSON.stringify({
    id_token: oauthToken.id_token,
    expires_in: oauthToken.expires_in,
  })}; refreshToken=${JSON.stringify({ refresh_token: oauthToken.refresh_token })}`;
  if (idPoolId) {
    event.requestContext.identity.cognitoIdentityId = idPoolId;
  }
  const auditEvent = getDummyAuditEvent();

  // Call API expect success
  await runPreExecutionChecks(event, dummyContext, auditEvent, repositoryProvider);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return event.headers['userUlid']!;
};
