/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  auditService,
  CaseAction,
  DEAGatewayProxyHandler,
  runPreExecutionChecks,
  ValidationError,
  verifyCaseACLs,
} from '@aws/dea-app';
import {
  ActorIdentity,
  AuditEventResult,
  AuditEventSource,
  AuditEventType,
  CJISAuditEventBody,
  IdentityType,
} from '@aws/dea-app/lib/app/services/audit-service';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { logger } from '../logger';
import { deaApiRouteConfig } from '../resources/dea-route-config';
import { exceptionHandlers } from './exception-handlers';

export const NO_ACL = [];
// This will wrap our handlers in any top level, prerequisite type code that we want to run prior to our lambdas.
// This adds a try/catch for the wrapped lambda
// - you should only be writing your own try/catch if you are planning to handle errors locally for some reason (e.g. retries).
export const createDeaHandler = (
  handler: DEAGatewayProxyHandler,
  requiredActions: ReadonlyArray<CaseAction>,
  /* the default case is handled in e2e and integration tests */
  /* istanbul ignore next */
  preExecutionChecks = runPreExecutionChecks,
  deaAuditService = auditService,
  preExecutionVerifyCaseACLs = verifyCaseACLs
): DEAGatewayProxyHandler => {
  const wrappedHandler: DEAGatewayProxyHandler = async (event, context) => {
    const auditEvent = initialAuditEvent(event);
    try {
      logger.debug(`Event`, { Data: JSON.stringify(event, null, 2) });
      logger.debug(`Context`, { Data: JSON.stringify(context, null, 2) });

      if (auditEvent.eventType === AuditEventType.UNKNOWN) {
        logger.error('An Audit Event was not found for the requested method', {
          resource: event.resource,
          httpMethod: event.httpMethod,
        });
        throw new Error();
      }

      if (auditEvent.actorIdentity.idType == IdentityType.UNIDENTIFIED_REQUESTOR) {
        logger.error('Identifying information was not found for the requested method', {
          resource: event.resource,
          httpMethod: event.httpMethod,
        });
        throw new ValidationError('Authentication information missing.');
      }

      // Before we run the handler, run the pre-execution checks
      // which include adding first time federated users to the db
      // so they can be invited to cases later, and session management
      // checks, like session lock and no concurrent active sessions
      await preExecutionChecks(event, context, auditEvent);

      await preExecutionVerifyCaseACLs(event, requiredActions);

      const result = await handler(event, context);
      if (result.statusCode >= 200 && result.statusCode < 300) {
        auditEvent.result = AuditEventResult.SUCCESS;
      }
      return result;
    } catch (error) {
      logger.error('Error', { Body: JSON.stringify(error) });
      if (typeof error === 'object') {
        if ('name' in error) {
          const errorHandler = exceptionHandlers.get(error.name);
          if (errorHandler) {
            return errorHandler(error);
          }
        }
      }

      return Promise.resolve({
        statusCode: 500,
        body: 'Server Error',
      });
    } finally {
      await deaAuditService.writeCJISCompliantEntry(auditEvent);
    }
  };
  return wrappedHandler;
};

const initialAuditEvent = (event: APIGatewayProxyEvent): CJISAuditEventBody => {
  return {
    dateTime: new Date().toISOString(),
    requestPath: event.resource,
    sourceComponent: AuditEventSource.API_GATEWAY,
    eventType: getEventType(event),
    actorIdentity: getInitialIdentity(event),
    result: AuditEventResult.FAILURE,
  };
};

const getInitialIdentity = (event: APIGatewayProxyEvent): ActorIdentity => {
  if (event.requestContext.identity.cognitoIdentityId) {
    return {
      idType: IdentityType.COGNITO_ID,
      sourceIp: event.requestContext.identity.sourceIp,
      id: event.requestContext.identity.cognitoIdentityId,
    };
  }

  if (event.pathParameters) {
    const authCode = event.pathParameters['authCode'];
    if (authCode) {
      return {
        idType: IdentityType.AUTH_CODE_REQUESTOR,
        sourceIp: event.requestContext.identity.sourceIp,
        authCode,
      };
    }

    const idToken = event.pathParameters['idToken'];
    if (idToken) {
      return {
        idType: IdentityType.ID_TOKEN_REQUESTOR,
        sourceIp: event.requestContext.identity.sourceIp,
        idToken,
      };
    }
  }

  return {
    idType: IdentityType.UNIDENTIFIED_REQUESTOR,
    sourceIp: event.requestContext.identity.sourceIp,
  };
};

const getEventType = (event: APIGatewayProxyEvent): AuditEventType => {
  event.requestContext.identity;
  const resource = event.resource;
  const httpMethod = event.httpMethod;
  const route = deaApiRouteConfig.routes.find(
    (route) => route.path === resource && route.httpMethod === httpMethod
  );
  if (!route) {
    return AuditEventType.UNKNOWN;
  }

  return route.eventName;
};
