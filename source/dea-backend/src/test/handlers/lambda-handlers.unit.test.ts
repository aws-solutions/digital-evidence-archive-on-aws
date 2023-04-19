/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as CompleteCaseFileUploadHandler from '../../handlers/complete-case-file-upload-handler';
import * as CreateCaseOwnerHandler from '../../handlers/create-case-owner-handler';
import * as CreateCaseUserHandler from '../../handlers/create-case-user-handler';
import * as CreateCasesHandler from '../../handlers/create-cases-handler';
import * as DeleteCasesHandler from '../../handlers/delete-case-handler';
import * as DeleteCaseUserHandler from '../../handlers/delete-case-user-handler';
import * as DownloadCaseFileHandler from '../../handlers/download-case-file-handler';
import * as GetAllCasesHandler from '../../handlers/get-all-cases-handler';
import * as GetAvailableEndpoints from '../../handlers/get-available-endpoints-handler';
import * as GetCaseActionsHandler from '../../handlers/get-case-actions-handler';
import * as GetCaseAuditHandler from '../../handlers/get-case-audit-handler';
import * as GetCaseDetailHandler from '../../handlers/get-case-detail-handler';
import * as GetCaseFileAuditHandler from '../../handlers/get-case-file-audit-handler';
import * as GetCaseFileDetailHandler from '../../handlers/get-case-file-detail-handler';
import * as GetCaseMembershipHandler from '../../handlers/get-case-membership-handler';
import * as GetLoginUrlHandler from '../../handlers/get-login-url-handler';
import * as GetLogoutUrlHandler from '../../handlers/get-logout-url-handler';
import * as GetMyCasesHandler from '../../handlers/get-my-cases-handler';
import * as GetScopedCaseInformation from '../../handlers/get-scoped-case-info-handler';
import * as GetSystemAuditHandler from '../../handlers/get-system-audit-handler';
import * as GetTokenHandler from '../../handlers/get-token-handler';
import * as GetUserAuditHandler from '../../handlers/get-user-audit-handler';
import * as GetUsersHandler from '../../handlers/get-users-handler';
import * as InitiateCaseFileUploadHandler from '../../handlers/initiate-case-file-upload-handler';
import * as ListCaseFilesHandler from '../../handlers/list-case-files-handler';
import * as RefreshTokenHandler from '../../handlers/refresh-token-handler';
import * as StartCaseAuditHandler from '../../handlers/request-case-audit-handler';
import * as StartCaseFileAuditHandler from '../../handlers/request-case-file-audit-handler';
import * as StartSystemAuditHandler from '../../handlers/request-system-audit-handler';
import * as StartUserAuditHandler from '../../handlers/request-user-audit-handler';
import * as RevokeTokenHandler from '../../handlers/revoke-token-handler';
import * as S3BatchDeleteCaseFileHandler from '../../handlers/s3-batch-delete-case-file-handler';
import * as S3BatchJobStatusChangeHandler from '../../handlers/s3-batch-job-status-change-handler';
import * as UpdateCaseStatusHandler from '../../handlers/update-case-status-handler';
import * as UpdateCaseUserHandler from '../../handlers/update-case-user-handler';
import * as UpdateCasesHandler from '../../handlers/update-cases-handler';

describe('lambda handlers', () => {
  it('should be wrapped with the deaHandler', () => {
    const handlers = [
      CreateCasesHandler.handler,
      CreateCaseOwnerHandler.handler,
      CreateCaseUserHandler.handler,
      CompleteCaseFileUploadHandler.handler,
      DeleteCasesHandler.handler,
      DownloadCaseFileHandler.handler,
      GetAllCasesHandler.handler,
      GetLoginUrlHandler.handler,
      GetLogoutUrlHandler.handler,
      GetCaseDetailHandler.handler,
      GetCaseFileDetailHandler.handler,
      GetMyCasesHandler.handler,
      InitiateCaseFileUploadHandler.handler,
      ListCaseFilesHandler.handler,
      UpdateCasesHandler.handler,
      DeleteCaseUserHandler.handler,
      GetTokenHandler.handler,
      RefreshTokenHandler.handler,
      RevokeTokenHandler.handler,
      GetUsersHandler.handler,
      UpdateCaseUserHandler.handler,
      GetCaseMembershipHandler.handler,
      StartCaseAuditHandler.handler,
      GetCaseAuditHandler.handler,
      StartCaseFileAuditHandler.handler,
      GetCaseFileAuditHandler.handler,
      StartSystemAuditHandler.handler,
      GetSystemAuditHandler.handler,
      StartUserAuditHandler.handler,
      GetUserAuditHandler.handler,
      GetCaseActionsHandler.handler,
      GetAvailableEndpoints.handler,
      UpdateCaseStatusHandler.handler,
      GetScopedCaseInformation.handler,
    ];

    handlers.forEach((handler) => {
      expect(typeof handler === 'function').toBeTruthy();
    });
  });

  it('should not be wrapped with the deaHandler', () => {
    const handlers = [S3BatchDeleteCaseFileHandler, S3BatchJobStatusChangeHandler];

    handlers.forEach((handler) => {
      expect(typeof handler === 'function').toBeFalsy();
    });
  });
});
