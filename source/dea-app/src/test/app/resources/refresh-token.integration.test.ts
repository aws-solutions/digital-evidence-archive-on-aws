/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { ReauthenticationError } from '../../../app/exceptions/reauthentication-exception';
import { runPreExecutionChecks } from '../../../app/resources/dea-lambda-utils';
import { getToken } from '../../../app/resources/get-token';
import { refreshToken } from '../../../app/resources/refresh-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/auth-service';
import { Oauth2Token } from '../../../models/auth';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { getSession } from '../../../persistence/session';
import { getAuthorizationCode, getPkceStrings, PkceStrings } from '../../../test-e2e/helpers/auth-helper';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import {
  dummyContext,
  getDummyAuditEvent,
  getDummyEvent,
  setCookieToCookie,
} from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let cognitoParams: CognitoSsmParams;
let repositoryProvider: ModelRepositoryProvider;
let pkceStrings: PkceStrings;

describe('refresh-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'RefreshTokenIntegrationTestUser';
  const firstName = 'CognitoRefreshTokenHelper';
  const lastName = 'TestUser';

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
    const auditEvent = getDummyAuditEvent();

    // call runLambdaPrechecks to add session to database
    await runPreExecutionChecks(dummyEvent, dummyContext, auditEvent, repositoryProvider);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userUlid = dummyEvent.headers['userUlid']!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tokenId = dummyEvent.headers['tokenJti']!;

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

    // assert original session is marked as revoked
    const session1 = await getSession(userUlid, tokenId, repositoryProvider);
    expect(session1).toBeDefined();
    expect(session1?.isRevoked).toBeTruthy();

    // call API with old id token, it should fail session checks
    await expect(
      runPreExecutionChecks(dummyEvent, dummyContext, auditEvent, repositoryProvider)
    ).rejects.toThrow(ReauthenticationError);

    // call API with the new id token, it should pass session checks
    const dummyEvent1 = getDummyEvent();
    dummyEvent1.headers['cookie'] = newCookie;
    await runPreExecutionChecks(dummyEvent1, dummyContext, auditEvent, repositoryProvider);

    // Check new session exists
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const newTokenId = dummyEvent1.headers['tokenJti']!;
    const session2 = await getSession(userUlid, newTokenId, repositoryProvider);
    expect(session2).toBeDefined();
    expect(session2?.isRevoked).toBeFalsy();
  }, 40000);
});
