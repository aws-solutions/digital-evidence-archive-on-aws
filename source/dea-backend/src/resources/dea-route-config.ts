/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AuditEventType } from '@aws/dea-app/lib/app/services/audit-service';
import { AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { ApiGatewayMethod, ApiGatewayRouteConfig } from './api-gateway-route-config';

export const deaApiRouteConfig: ApiGatewayRouteConfig = {
  routes: [
    {
      eventName: AuditEventType.GET_MY_CASES,
      path: '/cases/my-cases',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-my-cases-handler.ts',
      pagination: true,
    },
    {
      eventName: AuditEventType.CREATE_CASE,
      path: '/cases',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-cases-handler.ts',
    },
    {
      eventName: AuditEventType.GET_CASE_DETAILS,
      path: '/cases/{caseId}/details',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-case-detail-handler.ts',
    },
    {
      eventName: AuditEventType.GET_CASE_ACTIONS,
      path: '/cases/{caseId}/actions',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-case-actions-handler.ts',
    },
    {
      eventName: AuditEventType.UPDATE_CASE_DETAILS,
      path: '/cases/{caseId}/details',
      httpMethod: ApiGatewayMethod.PUT,
      pathToSource: '../../src/handlers/update-cases-handler.ts',
    },
    {
      eventName: AuditEventType.UPDATE_CASE_STATUS,
      path: '/cases/{caseId}/status',
      httpMethod: ApiGatewayMethod.PUT,
      pathToSource: '../../src/handlers/update-case-status-handler.ts',
    },
    {
      eventName: AuditEventType.GET_USERS_FROM_CASE,
      path: '/cases/{caseId}/userMemberships',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-case-membership-handler.ts',
    },
    {
      eventName: AuditEventType.INVITE_USER_TO_CASE,
      path: '/cases/{caseId}/userMemberships',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-case-user-handler.ts',
    },
    {
      eventName: AuditEventType.REMOVE_USER_FROM_CASE,
      path: '/cases/{caseId}/users/{userId}/memberships',
      httpMethod: ApiGatewayMethod.DELETE,
      pathToSource: '../../src/handlers/delete-case-user-handler.ts',
    },
    {
      eventName: AuditEventType.MODIFY_USER_PERMISSIONS_ON_CASE,
      path: '/cases/{caseId}/users/{userId}/memberships',
      httpMethod: ApiGatewayMethod.PUT,
      pathToSource: '../../src/handlers/update-case-user-handler.ts',
    },
    {
      eventName: AuditEventType.INITIATE_CASE_FILE_UPLOAD,
      path: '/cases/{caseId}/files',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/initiate-case-file-upload-handler.ts',
    },
    {
      eventName: AuditEventType.GET_CASE_FILES,
      path: '/cases/{caseId}/files',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/list-case-files-handler.ts',
    },
    {
      eventName: AuditEventType.COMPLETE_CASE_FILE_UPLOAD,
      path: '/cases/{caseId}/files/{fileId}/contents',
      httpMethod: ApiGatewayMethod.PUT,
      pathToSource: '../../src/handlers/complete-case-file-upload-handler.ts',
    },
    {
      eventName: AuditEventType.GET_CASE_FILE_DETAIL,
      path: '/cases/{caseId}/files/{fileId}/info',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-case-file-detail-handler.ts',
    },
    {
      eventName: AuditEventType.DOWNLOAD_CASE_FILE,
      path: '/cases/{caseId}/files/{fileId}/contents',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/download-case-file-handler.ts',
    },
    {
      eventName: AuditEventType.RESTORE_CASE_FILE,
      path: '/cases/{caseId}/files/{fileId}/restore',
      httpMethod: ApiGatewayMethod.PUT,
      pathToSource: '../../src/handlers/restore-case-file-handler.ts',
    },
    {
      eventName: AuditEventType.GET_AUTH_TOKEN,
      path: '/auth/{authCode}/token',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/get-token-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access token exchange
      // None for now, since this is the first endpoint we hit after logging in before
      // we have the id_token
      authMethod: AuthorizationType.NONE,
    },
    {
      eventName: AuditEventType.REFRESH_AUTH_TOKEN,
      path: '/auth/refreshToken',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/refresh-token-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access credentials
      authMethod: AuthorizationType.NONE,
    },
    {
      eventName: AuditEventType.REVOKE_AUTH_TOKEN,
      path: '/auth/revokeToken',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/revoke-token-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access credentials
      authMethod: AuthorizationType.NONE,
    },
    {
      eventName: AuditEventType.GET_LOGIN_URL,
      path: '/auth/loginUrl',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-login-url-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access credentials
      authMethod: AuthorizationType.NONE,
    },
    {
      eventName: AuditEventType.GET_LOGOUT_URL,
      path: '/auth/logoutUrl',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-logout-url-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access credentials
      authMethod: AuthorizationType.NONE,
    },
    {
      eventName: AuditEventType.GET_ALL_USERS,
      path: '/users',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-users-handler.ts',
      queryParams: ['nameBeginsWith'],
    },
    {
      eventName: AuditEventType.GET_CASE_AUDIT,
      path: '/cases/{caseId}/audit/{auditId}/csv',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-case-audit-handler.ts',
    },
    {
      eventName: AuditEventType.REQUEST_CASE_AUDIT,
      path: '/cases/{caseId}/audit',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/request-case-audit-handler.ts',
    },
    {
      eventName: AuditEventType.GET_CASE_FILE_AUDIT,
      path: '/cases/{caseId}/files/{fileId}/audit/{auditId}/csv',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-case-file-audit-handler.ts',
    },
    {
      eventName: AuditEventType.REQUEST_CASE_FILE_AUDIT,
      path: '/cases/{caseId}/files/{fileId}/audit',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/request-case-file-audit-handler.ts',
    },
    {
      eventName: AuditEventType.GET_AVAILABLE_ENDPOINTS,
      path: '/availableEndpoints',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-available-endpoints-handler.ts',
    },
    // PRIVILEGED ENDPOINTS
    {
      // intended for evidence managers/admins to see a specific set of case details
      eventName: AuditEventType.GET_SCOPED_CASE_INFO,
      path: '/cases/{caseId}/scopedInformation',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-scoped-case-info-handler.ts',
    },
    {
      eventName: AuditEventType.GET_ALL_CASES,
      path: '/cases/all-cases',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-all-cases-handler.ts',
      pagination: true,
    },
    {
      eventName: AuditEventType.DELETE_CASE,
      path: '/cases/{caseId}/details',
      httpMethod: ApiGatewayMethod.DELETE,
      pathToSource: '../../src/handlers/delete-case-handler.ts',
    },
    {
      eventName: AuditEventType.CREATE_CASE_OWNER,
      path: '/cases/{caseId}/owner',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-case-owner-handler.ts',
    },
    {
      eventName: AuditEventType.GET_USER_AUDIT,
      path: '/users/{userId}/audit/{auditId}/csv',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-user-audit-handler.ts',
    },
    {
      eventName: AuditEventType.REQUEST_USER_AUDIT,
      path: '/users/{userId}/audit',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/request-user-audit-handler.ts',
    },
    {
      eventName: AuditEventType.GET_SYSTEM_AUDIT,
      path: '/system/audit/{auditId}/csv',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-system-audit-handler.ts',
    },
    {
      eventName: AuditEventType.REQUEST_SYSTEM_AUDIT,
      path: '/system/audit',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/request-system-audit-handler.ts',
    },
  ],
};
