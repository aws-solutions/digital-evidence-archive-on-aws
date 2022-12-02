/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  APIGatewayAuthorizerCallback,
  APIGatewayTokenAuthorizerEvent,
  AuthResponse,
  PolicyDocument,
} from 'aws-lambda';

// TODO: once Cognito it added, replace this function for one that takes
// the cognito-group(s) from the Cognito AuthN response, and grabs the
// corresponding policy(s) from IAM
// For now: just allow or deny access to the desired function
const getPolicy = (principalId: string, allowAccess: string, resource: string): AuthResponse => {
  const policyDocument: PolicyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: allowAccess,
        Resource: resource,
      },
    ],
  };

  const authResponse: AuthResponse = {
    principalId: principalId,
    policyDocument: policyDocument,
  };

  return authResponse;
};

// TODO: once Cognito is added, add token validation here, as well
// as verifying with Cognito that the session is still valid
function validateToken(token: string, methodArn: string, callback: APIGatewayAuthorizerCallback): void {
  switch (token) {
    case 'allow':
      callback(null, getPolicy('user', 'Allow', methodArn));
      break;
    case 'deny':
      callback(null, getPolicy('user', 'Deny', methodArn));
      break;
    case 'unauthorized':
      callback('Unauthorized'); // Return a 401 Unauthorized response
      break;
    default:
      callback('Error: Invalid token'); // Return a 500 Invalid token response
  }
}

// TODO add session management checks

export const customAuthorizer = async (
  event: APIGatewayTokenAuthorizerEvent,
  callback: APIGatewayAuthorizerCallback
): Promise<void> => {
  const token = event.authorizationToken;
  const methodArn = event.methodArn;

  validateToken(token, methodArn, callback);
};
