/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ValidationError } from '@aws/dea-app/lib/app/exceptions/validation-exception';
import { DEAGatewayProxyHandler } from '@aws/dea-app/lib/app/resources/dea-gateway-proxy-handler';
import { runPreExecutionChecks, withAllowedOrigin } from '@aws/dea-app/lib/app/resources/dea-lambda-utils';
import { verifyCaseACLs } from '@aws/dea-app/lib/app/resources/verify-case-acls';
import {
  ActorIdentity,
  AuditEventResult,
  AuditEventSource,
  AuditEventType,
  CJISAuditEventBody,
  IdentityType,
  auditService,
} from '@aws/dea-app/lib/app/services/audit-service';
import { removeSensitiveHeaders } from '@aws/dea-app/lib/lambda-http-helpers';
import { Oauth2Token } from '@aws/dea-app/lib/models/auth';
import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { CaseOwnerDTO, CaseUserDTO } from '@aws/dea-app/lib/models/dtos/case-user-dto';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
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
  const wrappedHandler: DEAGatewayProxyHandler = async (event: APIGatewayProxyEvent, context: Context) => {
    const auditEvent = initialAuditEvent(event);
    try {
      const debugHeaders = removeSensitiveHeaders(event.headers);
      const { headers: _, multiValueHeaders: _1, ...debugEvent } = event;
      logger.debug(`Headers`, debugHeaders);
      logger.debug(`Event`, debugEvent);
      logger.debug(`Context`, context);

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

        parseEventForExtendedAuditFields(event, auditEvent, result);
      }
      return result;
    } catch (error) {
      logger.error('Error', error);
      if (typeof error === 'object') {
        const errorHandler = exceptionHandlers.get(getErrorName(error));
        if (errorHandler) {
          return errorHandler(error, event);
        }
      }

      return Promise.resolve(
        withAllowedOrigin(event, {
          statusCode: 500,
          body: 'Server Error',
        })
      );
    } finally {
      await deaAuditService.writeCJISCompliantEntry(auditEvent);
    }
  };

  return wrappedHandler;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getErrorName = (error: any): string => {
  // OneTableError's code property has the underline DynamoDB error name https://doc.onetable.io/api/errors/
  if ('code' in error) {
    return error.code;
  }
  if ('name' in error) {
    return error.name;
  }
  return '';
};

const initialAuditEvent = (event: APIGatewayProxyEvent): CJISAuditEventBody => {
  return {
    dateTime: new Date().toISOString(),
    requestPath: event.resource,
    sourceComponent: AuditEventSource.API_GATEWAY,
    eventType: getEventType(event),
    actorIdentity: getInitialIdentity(event),
    result: AuditEventResult.FAILURE,
    caseId: event.pathParameters?.caseId,
    fileId: event.pathParameters?.fileId,
    targetUserId: getTargetUserId(event),
    eventID: uuidv4(),
  };
};

const getInitialIdentity = (event: APIGatewayProxyEvent): ActorIdentity => {
  if (event.requestContext.identity.cognitoIdentityId) {
    return {
      idType: IdentityType.COGNITO_ID,
      sourceIp: event.requestContext.identity.sourceIp,
      idPoolUserId: event.requestContext.identity.cognitoIdentityId,
    };
  }

  if (event.resource === '/auth/loginUrl') {
    return {
      idType: IdentityType.LOGIN_URL_REQUESTOR,
      sourceIp: event.requestContext.identity.sourceIp,
    };
  }

  if (event.resource === '/auth/logoutUrl') {
    return {
      idType: IdentityType.LOGOUT_URL_REQUESTOR,
      sourceIp: event.requestContext.identity.sourceIp,
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
  }

  if (event.headers['cookie']) {
    const token: Oauth2Token = JSON.parse(event.headers['cookie'].replace('idToken=', ''));
    return {
      idType: IdentityType.ID_TOKEN_REQUESTOR,
      sourceIp: event.requestContext.identity.sourceIp,
      idToken: token.id_token,
    };
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

const getTargetUserId = (event: APIGatewayProxyEvent): string | undefined => {
  const eventType = getEventType(event);
  const isCaseInviteAPI =
    eventType === AuditEventType.INVITE_USER_TO_CASE ||
    eventType === AuditEventType.MODIFY_USER_PERMISSIONS_ON_CASE ||
    eventType === AuditEventType.REMOVE_USER_FROM_CASE;
  if (isCaseInviteAPI && event.body) {
    try {
      const caseUser: CaseUserDTO = JSON.parse(event.body);
      return caseUser?.userUlid;
    } catch {
      // It means `JSON.parse` has thrown a SyntaxError.
      // The target endpoint will handle appropriately the payload issues.
      // We do nothing at this point we are trying our best to retrieve the `targetUserId` value from the body.
      return undefined;
    }
  }

  if (eventType === AuditEventType.CREATE_CASE_OWNER && event.body) {
    try {
      const caseOwner: CaseOwnerDTO = JSON.parse(event.body);
      return caseOwner?.userUlid;
    } catch {
      // It means `JSON.parse` has thrown a SyntaxError.
      // The target endpoint will handle appropriately the payload issues.
      // We do nothing at this point we are trying our best to retrieve the `targetUserId` value from the body.
      return undefined;
    }
  }
  return event.pathParameters?.userId;
};

const parseEventForExtendedAuditFields = (
  event: APIGatewayProxyEvent,
  auditEvent: CJISAuditEventBody,
  result: APIGatewayProxyResult
) => {
  const eventType = getEventType(event);

  const isCaseInviteAPI =
    eventType === AuditEventType.INVITE_USER_TO_CASE ||
    eventType === AuditEventType.MODIFY_USER_PERMISSIONS_ON_CASE;

  if (
    eventType !== AuditEventType.CREATE_CASE &&
    eventType !== AuditEventType.INITIATE_CASE_FILE_UPLOAD &&
    eventType !== AuditEventType.COMPLETE_CASE_FILE_UPLOAD &&
    !isCaseInviteAPI
  ) {
    return;
  }

  const body = JSON.parse(result.body);

  //Warn if caseId was not included on the CreateCase Operation
  if (eventType == AuditEventType.CREATE_CASE) {
    // Include case id if it was populated
    auditEvent.caseId = body.ulid;
    if (!auditEvent.caseId) {
      logger.error('CaseId was not included in auditEvent after complete case creation operation.', {
        resource: event.resource,
        httpMethod: event.httpMethod,
      });
      auditEvent.caseId = 'ERROR: case id is absent';
      auditEvent.result = AuditEventResult.SUCCESS_WITH_WARNINGS;
    }
  }

  // Warn if fileId was not included on the InitiateFileUpload Operation
  if (eventType == AuditEventType.INITIATE_CASE_FILE_UPLOAD) {
    // Include file id if it was populated
    auditEvent.fileId = body.ulid;
    if (!auditEvent.fileId) {
      logger.error('FileId was not included in auditEvent after initiate upload operation.', {
        resource: event.resource,
        httpMethod: event.httpMethod,
      });
      auditEvent.fileId = 'ERROR: file id is absent';
      auditEvent.result = AuditEventResult.SUCCESS_WITH_WARNINGS;
    }
  }

  // include file hash if it was included in the body of the response
  auditEvent.fileHash = body.sha256Hash;
  // Warn if the fileHash was not included on complete upload operation
  if (eventType == AuditEventType.COMPLETE_CASE_FILE_UPLOAD && !auditEvent.fileHash) {
    logger.error('File hash was not included in auditEvent after complete file upload operation.', {
      resource: event.resource,
      httpMethod: event.httpMethod,
    });
    auditEvent.fileHash = 'ERROR: hash is absent';
    auditEvent.result = AuditEventResult.SUCCESS_WITH_WARNINGS;
  }

  // Include case actions in the audit event
  // Use : instead of , to list actions, since audit is sent
  // in a csv format
  if (isCaseInviteAPI) {
    auditEvent.caseActions = body.actions?.join(':');
  }
};
