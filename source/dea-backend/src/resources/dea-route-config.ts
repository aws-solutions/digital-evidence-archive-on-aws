/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { AuditEventType } from '@aws/dea-app/lib/app/services/audit-service';
import { AuthorizationType } from 'aws-cdk-lib/aws-apigateway';
import { ApiGatewayMethod, ApiGatewayRouteConfig } from './api-gateway-route-config';

export enum DeaApiRoleName {
  AUTH_ROLE = 'AUTH_ROLE',
  INITIATE_UPLOAD_ROLE = 'INITIATE_UPLOAD_ROLE',
  COMPLETE_UPLOAD_ROLE = 'COMPLETE_UPLOAD_ROLE',
}

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
      roleName: DeaApiRoleName.INITIATE_UPLOAD_ROLE,
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
      roleName: DeaApiRoleName.COMPLETE_UPLOAD_ROLE,
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
      httpMethod: ApiGatewayMethod.POST,
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
      roleName: DeaApiRoleName.AUTH_ROLE,
    },
    {
      eventName: AuditEventType.REFRESH_AUTH_TOKEN,
      path: '/auth/refreshToken',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/refresh-token-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access credentials
      authMethod: AuthorizationType.NONE,
      roleName: DeaApiRoleName.AUTH_ROLE,
    },
    {
      eventName: AuditEventType.REVOKE_AUTH_TOKEN,
      path: '/auth/revokeToken',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/revoke-token-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access credentials
      authMethod: AuthorizationType.NONE,
      roleName: DeaApiRoleName.AUTH_ROLE,
    },
    {
      eventName: AuditEventType.GET_LOGIN_URL,
      path: '/auth/loginUrl',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-login-url-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access credentials
      authMethod: AuthorizationType.NONE,
      roleName: DeaApiRoleName.AUTH_ROLE,
    },
    {
      eventName: AuditEventType.GET_LOGOUT_URL,
      path: '/auth/logoutUrl',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-logout-url-handler.ts',
      // TODO: Implement custom authorizer for UI trying to access credentials
      authMethod: AuthorizationType.NONE,
      roleName: DeaApiRoleName.AUTH_ROLE,
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
    {
      eventName: AuditEventType.CREATE_DATA_VAULT,
      path: '/datavaults',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-data-vault-handler.ts',
    },
    {
      eventName: AuditEventType.GET_DATA_VAULTS,
      path: '/datavaults',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-data-vaults-handler.ts',
      pagination: true,
    },
    {
      eventName: AuditEventType.GET_DATA_VAULT_DETAILS,
      path: '/datavaults/{dataVaultId}/details',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-data-vault-details-handler.ts',
    },
    {
      eventName: AuditEventType.UPDATE_DATA_VAULT_DETAILS,
      path: '/datavaults/{dataVaultId}/details',
      httpMethod: ApiGatewayMethod.PUT,
      pathToSource: '../../src/handlers/update-data-vault-handler.ts',
    },
    {
      eventName: AuditEventType.GET_DATA_VAULT_FILES,
      path: '/datavaults/{dataVaultId}/files',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/list-data-vault-files-handler.ts',
    },
    {
      eventName: AuditEventType.CREATE_CASE_ASSOCIATION,
      path: '/datavaults/{dataVaultId}/caseAssociations',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-case-association-handler.ts',
    },
    {
      eventName: AuditEventType.GET_DATA_VAULT_FILE_DETAIL,
      path: '/datavaults/{dataVaultId}/files/{fileId}/info',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-data-vault-file-detail-handler.ts',
    },
    {
      eventName: AuditEventType.DELETE_CASE_ASSOCIATION,
      path: '/datavaults/{dataVaultId}/files/{fileId}/caseAssociations',
      httpMethod: ApiGatewayMethod.DELETE,
      pathToSource: '../../src/handlers/delete-case-association-handler.ts',
    },
    {
      eventName: AuditEventType.CREATE_DATA_VAULT_TASK,
      path: '/datavaults/{dataVaultId}/tasks',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-data-vault-task-handler.ts',
    },
    {
      eventName: AuditEventType.GET_DATA_SYNC_TASKS,
      path: '/datasync/tasks',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-data-sync-tasks-handler.ts',
    },
    {
      eventName: AuditEventType.CREATE_DATA_VAULT_EXECUTION,
      path: '/datavaults/tasks/{taskId}/executions',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/create-data-vault-execution-handler.ts',
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
    {
      eventName: AuditEventType.REQUEST_DATA_VAULT_FILE_AUDIT,
      path: '/datavaults/{dataVaultId}/files/{fileId}/audit',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/request-datavault-file-audit-handler.ts',
    },
    {
      eventName: AuditEventType.REQUEST_DATA_VAULT_AUDIT,
      path: '/datavaults/{dataVaultId}/audit',
      httpMethod: ApiGatewayMethod.POST,
      pathToSource: '../../src/handlers/request-datavault-audit-handler.ts',
    },
    {
      eventName: AuditEventType.GET_DATA_VAULT_FILE_AUDIT,
      path: '/datavaults/{dataVaultId}/files/{fileId}/audit/{auditId}/csv',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-datavault-file-audit-handler.ts',
    },
    {
      eventName: AuditEventType.GET_DATA_VAULT_AUDIT,
      path: '/datavaults/{dataVaultId}/audit/{auditId}/csv',
      httpMethod: ApiGatewayMethod.GET,
      pathToSource: '../../src/handlers/get-datavault-audit-handler.ts',
    },
  ],
};
