/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CognitoHelper, testEnv, testHelpers } from '@aws/dea-app';
import { callDeaAPIWithCreds, randomSuffix } from '@aws/dea-app/lib/test-e2e/resources/test-helpers';
import { AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { deaApiRouteConfig } from '../resources/dea-route-config';

const cognitoHelper = new CognitoHelper();
//remove the trailing slash for these tests
const deaApiUrl = testEnv.apiUrlOutput.substring(0, testEnv.apiUrlOutput.length - 1);

describe.skip('api gateway access policies', () => {
  deaApiRouteConfig.routes.forEach((route) => {
    if (route.authMethod !== AuthorizationType.NONE) {
      describe(`Route: ${route.path} policy`, () => {
        it('should only allow access to the intended enpoint', async () => {
          const roleName = `AllowDenyTest_${route.eventName}`;
          const roleUsername = `${roleName}_user_${randomSuffix()}`;
          await cognitoHelper.createUser(roleUsername, roleName, 'Bob', 'Dobalina');
          const [creds, idToken] = await cognitoHelper.getCredentialsForUser(roleUsername);

          const targetUrl = `${deaApiUrl}${route.path}`.replaceAll(/{.+?}/g, testHelpers.bogusUlid);

          const response = await callDeaAPIWithCreds(targetUrl, route.httpMethod, idToken, creds);
          //if IAM stops us we'll get a 403
          expect(response.status).not.toEqual(403);
          expect(response.status).not.toEqual(502);

          for (const blockedRoute of deaApiRouteConfig.routes) {
            if (
              blockedRoute.authMethod !== AuthorizationType.NONE &&
              blockedRoute.eventName !== route.eventName
            ) {
              const blockedUrl = `${deaApiUrl}${blockedRoute.path}`.replaceAll(
                /{.+?}/g,
                testHelpers.bogusUlid
              );

              const blockedResponse = await callDeaAPIWithCreds(
                blockedUrl,
                blockedRoute.httpMethod,
                idToken,
                creds
              );
              //if IAM stops us we'll get a 403
              expect(blockedResponse.status).toEqual(403);
            }
          }
        }, 60000);
      });
    }
  });
});
