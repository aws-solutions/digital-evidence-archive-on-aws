/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { ReauthenticationError } from '../../../app/exceptions/reauthentication-exception';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { runPreExecutionChecks } from '../../../app/resources/dea-lambda-utils';
import { getToken } from '../../../app/resources/get-token';
import { revokeToken } from '../../../app/resources/revoke-token';
import { CognitoSsmParams, getCognitoSsmParams } from '../../../app/services/auth-service';
import { Oauth2Token } from '../../../models/auth';
import { jsonParseWithDates } from '../../../models/validation/json-parse-with-dates';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { getSession } from '../../../persistence/session';
import { getAuthorizationCode } from '../../../test-e2e/helpers/auth-helper';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { dummyContext, getDummyAuditEvent, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let cognitoParams: CognitoSsmParams;
let idToken: string;
let repositoryProvider: ModelRepositoryProvider;

describe('revoke-token', () => {
  const cognitoHelper: CognitoHelper = new CognitoHelper();

  const testUser = 'RevokeCodeIntegrationTestUser';
  const firstName = 'CognitoTokenHelper';
  const lastName = 'TestUser';

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testUser, 'AuthTestGroup', firstName, lastName);
    cognitoParams = await getCognitoSsmParams();
    repositoryProvider = await getTestRepositoryProvider('revokeTokenTest');
  });

  afterAll(async () => {
    await cognitoHelper.cleanup(repositoryProvider);
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('successfully revoke an refresh token and mark session revoked', async () => {
    const authTestUrl = cognitoParams.callbackUrl.replace('/login', '/auth-test');

    const authCode = await getAuthorizationCode(
      cognitoParams.cognitoDomainUrl,
      authTestUrl,
      testUser,
      cognitoHelper.testPassword
    );

    const event = getDummyEvent({
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

    const retrievedTokens: Oauth2Token = jsonParseWithDates(response.body);

    // Store for next test
    idToken = retrievedTokens.id_token;

    const dummyEvent = getDummyEvent({
      body: JSON.stringify({
        refreshToken: retrievedTokens.refresh_token,
      }),
    });
    dummyEvent.headers['idToken'] = idToken;
    const auditEvent = getDummyAuditEvent();

    // call runLambdaPrechecks to add session to database
    // and also to populate the userUlid and tokenId headers in the event
    // which will be used to mark session as revoked (In production,
    // runLambdaPrechecks in automatically run before the code execution)
    await runPreExecutionChecks(dummyEvent, dummyContext, auditEvent, repositoryProvider);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const userUlid = dummyEvent.headers['userUlid']!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const tokenId = dummyEvent.headers['tokenJti']!;

    // assert session exists
    const session = await getSession(userUlid, tokenId, repositoryProvider);
    expect(session).toBeDefined();
    expect(session?.isRevoked).toBeFalsy();

    // revoke token (marks session as revoked)
    const revokeResponse = await revokeToken(dummyEvent, dummyContext, repositoryProvider);
    expect(revokeResponse.body).toEqual('200');

    // Check session is marked as revoked in ddb
    const revokedSession = await getSession(userUlid, tokenId, repositoryProvider);
    expect(revokedSession).toBeDefined();
    expect(revokedSession?.isRevoked).toBeTruthy();

    // try to run lambdaprechecks, should fail since session is revoked
    await expect(
      runPreExecutionChecks(dummyEvent, dummyContext, auditEvent, repositoryProvider)
    ).rejects.toThrow(ReauthenticationError);
  }, 40000);

  it('should throw an error if trying to revoke id token', async () => {
    const dummyEvent = getDummyEvent({
      body: JSON.stringify({
        refreshToken: idToken,
      }),
    });

    await expect(revokeToken(dummyEvent, dummyContext, repositoryProvider)).rejects.toThrow(
      'Request failed with status code 400'
    );
  }, 40000);

  it('should throw an error if the payload is missing', async () => {
    await expect(revokeToken(getDummyEvent(), dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );
  }, 40000);
});
