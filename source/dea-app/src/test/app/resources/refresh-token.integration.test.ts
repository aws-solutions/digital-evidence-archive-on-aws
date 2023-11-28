/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { runPreExecutionChecks } from '../../../app/resources/dea-lambda-utils';
import { getToken } from '../../../app/resources/get-token';
import { refreshToken } from '../../../app/resources/refresh-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/auth-service';
import { getSessionsForUser } from '../../../app/services/session-service';
import { Oauth2Token } from '../../../models/auth';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { getSession } from '../../../persistence/session';
import { PkceStrings, getAuthorizationCode, getPkceStrings } from '../../../test-e2e/helpers/auth-helper';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { randomSuffix } from '../../../test-e2e/resources/test-helpers';
import {
  dummyContext,
  getDummyAuditEvent,
  getDummyEvent,
  setCookieToCookie,
  setUserArnWithRole,
} from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let cognitoParams: CognitoSsmParams;
let repositoryProvider: ModelRepositoryProvider;
let pkceStrings: PkceStrings;

describe('refresh-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testUser = `RefreshTokenIntegrationTestUser${suffix}`;
  const firstName = 'CognitoRefreshTokenHelper';
  const lastName = 'TestUser';
  const OLD_ENV = process.env;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams();
    repositoryProvider = await getTestRepositoryProvider('refreshTokenTest');
    pkceStrings = getPkceStrings();
  });

  afterAll(async () => {
    await cognitoHelper.cleanup(repositoryProvider);
    await repositoryProvider.table.deleteTable('DeleteTableForever');
    process.env = OLD_ENV;
  });

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    process.env.SAMESITE = 'Strict';
  });

  it('successfully obtain an identity token for immediate use in the APIs', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser,
      cognitoHelper.testPassword,
      pkceStrings.code_challenge
    );

    const event = getDummyEvent({
      body: JSON.stringify({
        codeVerifier: pkceStrings.code_verifier,
      }),
      pathParameters: {
        authCode: authCode,
      },
      headers: {
        'callback-override': authTestUrl,
      },
    });

    const response = await getToken(event, dummyContext);
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    const cookie = setCookieToCookie(response);
    const authToken: Oauth2Token = JSON.parse(cookie.replace('idToken=', ''));
    const dummyEvent = getDummyEvent({
      headers: {
        cookie,
      },
    });
    setUserArnWithRole(dummyEvent, /*roleName=*/ 'CaseWorker');
    const auditEvent = getDummyAuditEvent();

    // call runLambdaPrechecks to add session to database
    await runPreExecutionChecks(dummyEvent, dummyContext, auditEvent, repositoryProvider);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userUlid = dummyEvent.headers['userUlid']!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tokenId = dummyEvent.headers['tokenId']!;

    // assert session exists
    const session = await getSession(userUlid, tokenId, repositoryProvider);
    expect(session).toBeDefined();
    expect(session?.isRevoked).toBeFalsy();

    // refresh token to get new id token
    const refreshResponse = await refreshToken(dummyEvent, dummyContext, repositoryProvider);
    expect(refreshResponse.statusCode).toEqual(200);
    const newCookie = setCookieToCookie(refreshResponse);
    const newAuthToken: Oauth2Token = JSON.parse(newCookie.replace('idToken=', ''));
    expect(newAuthToken.id_token).not.toStrictEqual(authToken.id_token);

    // call API with the new id token, it should pass session checks
    const dummyEvent1 = getDummyEvent();
    dummyEvent1.headers['cookie'] = newCookie;
    setUserArnWithRole(dummyEvent1, /*roleName=*/ 'CaseWorker');
    await runPreExecutionChecks(dummyEvent1, dummyContext, auditEvent, repositoryProvider);

    // Check only one session for the user
    // since the new and old id token share an origin_jti
    // the new id token should continue the old session
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const newTokenId = dummyEvent1.headers['tokenId']!;
    expect(newTokenId).toStrictEqual(tokenId); // they share a jti
    const sessions = await getSessionsForUser(userUlid, repositoryProvider);
    expect(sessions.length).toBe(1);
    const session2 = sessions[0];
    expect(session2).toBeDefined();
    expect(session2?.created).toBeDefined();
    expect(session2?.created).toStrictEqual(session?.created);
    expect(session2?.updated).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(session2?.updated?.getTime()).toBeGreaterThan(session2!.created!.getTime());
  }, 40000);

  it('should throw a validation error if the refreshToken is not valid', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser,
      cognitoHelper.testPassword,
      pkceStrings.code_challenge
    );

    const event = getDummyEvent({
      body: JSON.stringify({
        codeVerifier: pkceStrings.code_verifier,
      }),
      pathParameters: {
        authCode: authCode,
      },
      headers: {
        'callback-override': authTestUrl,
      },
    });

    const response = await getToken(event, dummyContext);
    expect(response.statusCode).toEqual(200);

    if (!response.body) {
      fail();
    }

    // Override the refresh_token with id_token value.
    const jsonBody = JSON.parse(response.body);
    const idToken: Oauth2Token = {
      id_token: jsonBody.idToken,
      refresh_token: jsonBody.idToken,
      expires_in: jsonBody.expiresIn,
    };
    const cookie = `idToken=${JSON.stringify(idToken)}`;

    const dummyEvent = getDummyEvent({
      headers: {
        cookie,
      },
    });
    setUserArnWithRole(dummyEvent, /*roleName=*/ 'CaseWorker');
    const auditEvent = getDummyAuditEvent();

    // call runLambdaPrechecks to add session to database
    await runPreExecutionChecks(dummyEvent, dummyContext, auditEvent, repositoryProvider);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userUlid = dummyEvent.headers['userUlid']!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tokenId = dummyEvent.headers['tokenId']!;

    // assert session exists
    const session = await getSession(userUlid, tokenId, repositoryProvider);
    expect(session).toBeDefined();
    expect(session?.isRevoked).toBeFalsy();

    await expect(refreshToken(dummyEvent, dummyContext, repositoryProvider)).rejects.toThrow(ValidationError);
  }, 40000);
});
