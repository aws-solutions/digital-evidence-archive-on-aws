/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import ErrorPrefixes from './app/error-prefixes';
import { putLegalHoldForCreatedS3AuditObject } from './app/event-handlers/put-legal-hold-for-created-s3-audit-object';
import { FORBIDDEN_ERROR_NAME, ForbiddenError } from './app/exceptions/forbidden-exception';
import { NOT_FOUND_ERROR_NAME, NotFoundError } from './app/exceptions/not-found-exception';
import {
  REAUTHENTICATION_ERROR_NAME,
  ReauthenticationError,
} from './app/exceptions/reauthentication-exception';
import { VALIDATION_ERROR_NAME, ValidationError } from './app/exceptions/validation-exception';
import { getCaseAudit } from './app/resources/audit/get-case-audit';
import { getCaseFileAudit } from './app/resources/audit/get-case-file-audit';
import { getDataVaultAudit } from './app/resources/audit/get-datavault-audit';
import { getDataVaultFileAudit } from './app/resources/audit/get-datavault-file-audit';
import { getSystemAudit } from './app/resources/audit/get-system-audit';
import { getUserAudit } from './app/resources/audit/get-user-audit';
import { startCaseAudit } from './app/resources/audit/start-case-audit';
import { startCaseFileAudit } from './app/resources/audit/start-case-file-audit';
import { startDataVaultAudit } from './app/resources/audit/start-datavault-audit';
import { startDataVaultFileAudit } from './app/resources/audit/start-datavault-file-audit';
import { startSystemAudit } from './app/resources/audit/start-system-audit';
import { startUserAudit } from './app/resources/audit/start-user-audit';
import { completeCaseFileUpload } from './app/resources/complete-case-file-upload';
import { createCaseMembership } from './app/resources/create-case-membership';
import { createCases } from './app/resources/create-cases';
import { DEAGatewayProxyHandler } from './app/resources/dea-gateway-proxy-handler';
import {
  DEAPreLambdaExecutionChecks,
  runPreExecutionChecks,
  withAllowedOrigin,
} from './app/resources/dea-lambda-utils';
import { deleteCaseMembership } from './app/resources/delete-case-membership';
import { deleteCase } from './app/resources/delete-cases';
import { downloadCaseFile } from './app/resources/download-case-file';
import { getAllCases } from './app/resources/get-all-cases';
import { getAvailableEndpointsForUser } from './app/resources/get-available-endpoints';
import { getCase } from './app/resources/get-case-details';
import { getCaseFileDetails } from './app/resources/get-case-file-details';
import { getCaseMembership } from './app/resources/get-case-membership';
import { getLoginUrl } from './app/resources/get-login-url';
import { getLogoutUrl } from './app/resources/get-logout-url';
import { getMyCases } from './app/resources/get-my-cases';
import { getScopedCaseInformation } from './app/resources/get-scoped-case-information';
import { getToken } from './app/resources/get-token';
import { getUsers } from './app/resources/get-users';
import { initiateCaseFileUpload } from './app/resources/initiate-case-file-upload';
import { listCaseFiles } from './app/resources/list-case-files';
import { refreshToken } from './app/resources/refresh-token';
import { restoreCaseFile } from './app/resources/restore-case-file';
import { revokeToken } from './app/resources/revoke-token';
import { updateCaseMembership } from './app/resources/update-case-membership';
import { updateCaseStatus } from './app/resources/update-case-status';
import { updateCases } from './app/resources/update-cases';
import { verifyCaseACLs } from './app/resources/verify-case-acls';
import { auditService } from './app/services/audit-service';
import { getCaseUser } from './app/services/case-user-service';
import * as ServiceConstants from './app/services/service-constants';
import { transformAuditEventForS3 } from './app/transform/audit-logs-to-s3-transformation-handler';
import { getRequiredPathParam, getUserUlid } from './lambda-http-helpers';
import { Oauth2Token, RefreshToken, RevokeToken } from './models/auth';
import { DeaCase } from './models/case';
import { CaseAction } from './models/case-action';
import { DeaCaseFile } from './models/case-file';
import { dataSyncExecutionEvent } from './storage/datasync-event-handler';
import {
  restrictAccountStatement,
  restrictAccountStatementStatementProps,
} from './storage/restrict-account-statement';
import { deleteCaseFileHandler } from './storage/s3-batch-delete-case-file-handler';
import {
  S3BatchEventBridgeDetail,
  s3BatchJobStatusChangeHandler,
} from './storage/s3-batch-job-status-change-handler';
import { dummyContext, getDummyEvent } from './test/integration-objects';
import { getTestAuditService } from './test/services/test-audit-service-provider';
import CognitoHelper from './test-e2e/helpers/cognito-helper';
import { testEnv } from './test-e2e/helpers/settings';
import * as testHelpers from './test-e2e/resources/test-helpers';

export {
  CaseAction,
  CognitoHelper,
  DEAGatewayProxyHandler,
  DEAPreLambdaExecutionChecks,
  DeaCase,
  DeaCaseFile,
  restrictAccountStatement,
  restrictAccountStatementStatementProps,
  ErrorPrefixes,
  FORBIDDEN_ERROR_NAME,
  ForbiddenError,
  NOT_FOUND_ERROR_NAME,
  NotFoundError,
  Oauth2Token,
  REAUTHENTICATION_ERROR_NAME,
  ReauthenticationError,
  RefreshToken,
  RevokeToken,
  S3BatchEventBridgeDetail,
  ServiceConstants,
  VALIDATION_ERROR_NAME,
  ValidationError,
  auditService,
  completeCaseFileUpload,
  createCaseMembership,
  createCases,
  dataSyncExecutionEvent,
  deleteCase,
  deleteCaseFileHandler,
  deleteCaseMembership,
  downloadCaseFile,
  dummyContext,
  getAllCases,
  getAvailableEndpointsForUser,
  getCase,
  getCaseAudit,
  getCaseFileAudit,
  getCaseFileDetails,
  getCaseMembership,
  getCaseUser,
  getDataVaultAudit,
  getDataVaultFileAudit,
  getDummyEvent,
  getLoginUrl,
  getLogoutUrl,
  getMyCases,
  getRequiredPathParam,
  getScopedCaseInformation,
  getSystemAudit,
  getTestAuditService,
  getToken,
  getUserAudit,
  getUserUlid,
  getUsers,
  initiateCaseFileUpload,
  listCaseFiles,
  putLegalHoldForCreatedS3AuditObject,
  refreshToken,
  restoreCaseFile,
  revokeToken,
  runPreExecutionChecks,
  s3BatchJobStatusChangeHandler,
  startCaseAudit,
  startCaseFileAudit,
  startDataVaultAudit,
  startDataVaultFileAudit,
  startSystemAudit,
  startUserAudit,
  testEnv,
  testHelpers,
  transformAuditEventForS3,
  updateCaseMembership,
  updateCaseStatus,
  updateCases,
  verifyCaseACLs,
  withAllowedOrigin,
};
