/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  APIGatewayAuthorizerCallback,
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  PolicyDocument,
} from 'aws-lambda';
import { customAuthorizer } from '../../app/custom-lambda-authorizer';

type LambdaResult = APIGatewayAuthorizerResult | Error | string | undefined;

const METHOD_ARN = 'arn:aws:execute-api:us-east-1:account-id:api-id/*/GET/my-cases';
// TODO: When Cognito is added, mock it to test the logic of the interactions,
const ALLOW_TOKEN = 'allow';
const DENY_TOKEN = 'deny';
const UNAUTHORIZED_TOKEN = 'unauthorized';
const INVALID_TOKEN = 'aaaabbbbccc';

const ALLOW_POLICY_DOCUMENT: PolicyDocument = {
  Version: '2012-10-17',
  Statement: [
    {
      Action: 'execute-api:Invoke',
      Effect: 'Allow',
      Resource: METHOD_ARN,
    },
  ],
};
const ALLOW_POLICY_DOCUMENT_STRING = JSON.stringify(ALLOW_POLICY_DOCUMENT);

const DENY_POLICY_DOCUMENT: PolicyDocument = {
  Version: '2012-10-17',
  Statement: [
    {
      Action: 'execute-api:Invoke',
      Effect: 'Deny',
      Resource: METHOD_ARN,
    },
  ],
};
const DENY_POLICY_DOCUMENT_STRING = JSON.stringify(DENY_POLICY_DOCUMENT);

//this is covered already and provided as an example of jest import mocking
describe('Unit tests for custom lambda authorizer', () => {
  it('verifies successful response', async () => {
    const event: APIGatewayTokenAuthorizerEvent = createEvent(ALLOW_TOKEN);

    let lambdaResult: LambdaResult;
    const callback: APIGatewayAuthorizerCallback = (
      error?: Error | string | null,
      result?: APIGatewayAuthorizerResult
    ) => {
      if (result) {
        lambdaResult = result;
      } else {
        lambdaResult = error === null ? undefined : error;
      }
    };

    await customAuthorizer(event, callback);

    expect(isAnAuthResult(lambdaResult)).toBe(true);

    // eslint-disable-next-line
    const authResult = lambdaResult as APIGatewayAuthorizerResult;
    expect(authResult.principalId).toEqual('user');
    expect(JSON.stringify(authResult.policyDocument)).toEqual(ALLOW_POLICY_DOCUMENT_STRING);
  });

  it('verifies deny response', async () => {
    const event: APIGatewayTokenAuthorizerEvent = createEvent(DENY_TOKEN);

    let lambdaResult: LambdaResult;
    const callback: APIGatewayAuthorizerCallback = (
      error?: Error | string | null,
      result?: APIGatewayAuthorizerResult
    ) => {
      if (result) {
        lambdaResult = result;
      } else {
        lambdaResult = error === null ? undefined : error;
      }
    };

    await customAuthorizer(event, callback);

    expect(isAnAuthResult(lambdaResult)).toBe(true);

    // eslint-disable-next-line
    const authResult = lambdaResult as APIGatewayAuthorizerResult;
    expect(authResult.principalId).toEqual('user');
    expect(JSON.stringify(authResult.policyDocument)).toEqual(DENY_POLICY_DOCUMENT_STRING);
  });

  it('verifies unauthorized response', async () => {
    const event: APIGatewayTokenAuthorizerEvent = createEvent(UNAUTHORIZED_TOKEN);

    let lambdaResult: LambdaResult;
    const callback: APIGatewayAuthorizerCallback = (
      error?: Error | string | null,
      result?: APIGatewayAuthorizerResult
    ) => {
      if (result) {
        lambdaResult = result;
      } else {
        lambdaResult = error === null ? undefined : error;
      }
    };

    await customAuthorizer(event, callback);

    expect(typeof lambdaResult).toBe('string');

    // eslint-disable-next-line
    const authResult = lambdaResult as string;
    expect(lambdaResult).toEqual('Unauthorized');
  });

  it('verifies invalid token response', async () => {
    const event: APIGatewayTokenAuthorizerEvent = createEvent(INVALID_TOKEN);

    let lambdaResult: LambdaResult;
    const callback: APIGatewayAuthorizerCallback = (
      error?: Error | string | null,
      result?: APIGatewayAuthorizerResult
    ) => {
      if (result) {
        lambdaResult = result;
      } else {
        lambdaResult = error === null ? undefined : error;
      }
    };

    await customAuthorizer(event, callback);

    expect(typeof lambdaResult).toBe('string');

    // eslint-disable-next-line
    const authResult = lambdaResult as string;
    expect(lambdaResult).toEqual('Error: Invalid token');
  });
});

function createEvent(token: string): APIGatewayTokenAuthorizerEvent {
  return {
    type: 'TOKEN',
    methodArn: METHOD_ARN,
    authorizationToken: token,
  };
}

// eslint-disable-next-line
function isAnAuthResult(lambdaResult: any): boolean {
  return 'principalId' in lambdaResult && 'policyDocument' in lambdaResult;
}
