/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FORBIDDEN_ERROR_NAME, ForbiddenError } from './app/exceptions/forbidden-exception';
import { NOT_FOUND_ERROR_NAME, NotFoundError } from './app/exceptions/not-found-exception';
import {
  REAUTHENTICATION_ERROR_NAME,
  ReauthenticationError,
} from './app/exceptions/reauthentication-exception';
import { VALIDATION_ERROR_NAME, ValidationError } from './app/exceptions/validation-exception';
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
import { getCaseAudit } from './app/resources/get-case-audit';
import { getCase } from './app/resources/get-case-details';
import { getCaseFileAudit } from './app/resources/get-case-file-audit';
import { getCaseFileDetails } from './app/resources/get-case-file-details';
import { getCaseMembership } from './app/resources/get-case-membership';
import { getLoginUrl } from './app/resources/get-login-url';
import { getLogoutUrl } from './app/resources/get-logout-url';
import { getMyCases } from './app/resources/get-my-cases';
import { getScopedCaseInformation } from './app/resources/get-scoped-case-information';
import { getSystemAudit } from './app/resources/get-system-audit';
import { getToken } from './app/resources/get-token';
import { getUserAudit } from './app/resources/get-user-audit';
import { getUsers } from './app/resources/get-users';
import { initiateCaseFileUpload } from './app/resources/initiate-case-file-upload';
import { listCaseFiles } from './app/resources/list-case-files';
import { refreshToken } from './app/resources/refresh-token';
import { revokeToken } from './app/resources/revoke-token';
import { startCaseAudit } from './app/resources/start-case-audit';
import { startCaseFileAudit } from './app/resources/start-case-file-audit';
import { startSystemAudit } from './app/resources/start-system-audit';
import { startUserAudit } from './app/resources/start-user-audit';
import { updateCaseMembership } from './app/resources/update-case-membership';
import { updateCaseStatus } from './app/resources/update-case-status';
import { updateCases } from './app/resources/update-cases';
import { verifyCaseACLs } from './app/resources/verify-case-acls';
import { auditService } from './app/services/audit-service';
import { getCaseUser } from './app/services/case-user-service';
import { getRequiredPathParam, getUserUlid } from './lambda-http-helpers';
import { Oauth2Token, RefreshToken, RevokeToken } from './models/auth';
import { DeaCase } from './models/case';
import { CaseAction } from './models/case-action';
import { DeaCaseFile } from './models/case-file';
import { deleteCaseFileHandler } from './storage/s3-batch-delete-case-file-handler';
import {
  s3BatchJobStatusChangeHandler,
  S3BatchEventBridgeDetail,
} from './storage/s3-batch-job-status-change-handler';
import { dummyContext, getDummyEvent } from './test/integration-objects';
import { getTestAuditService } from './test/services/test-audit-service-provider';
import CognitoHelper from './test-e2e/helpers/cognito-helper';
import { testEnv } from './test-e2e/helpers/settings';
import * as testHelpers from './test-e2e/resources/test-helpers';

export {
  auditService,
  getToken,
  refreshToken,
  revokeToken,
  getLoginUrl,
  getLogoutUrl,
  createCases,
  deleteCase,
  getAllCases,
  getMyCases,
  getCase,
  getCaseFileDetails,
  listCaseFiles,
  initiateCaseFileUpload,
  completeCaseFileUpload,
  downloadCaseFile,
  runPreExecutionChecks,
  updateCases,
  updateCaseStatus,
  createCaseMembership,
  deleteCaseMembership,
  getCaseMembership,
  getCaseUser,
  startCaseAudit,
  getCaseAudit,
  startCaseFileAudit,
  getCaseFileAudit,
  getRequiredPathParam,
  getScopedCaseInformation,
  getUsers,
  getUserUlid,
  updateCaseMembership,
  verifyCaseACLs,
  getTestAuditService,
  getDummyEvent,
  getAvailableEndpointsForUser,
  startUserAudit,
  getUserAudit,
  startSystemAudit,
  getSystemAudit,
  CaseAction,
  DeaCase,
  DeaCaseFile,
  Oauth2Token,
  RefreshToken,
  RevokeToken,
  DEAGatewayProxyHandler,
  DEAPreLambdaExecutionChecks,
  ForbiddenError,
  FORBIDDEN_ERROR_NAME,
  NotFoundError,
  NOT_FOUND_ERROR_NAME,
  ReauthenticationError,
  REAUTHENTICATION_ERROR_NAME,
  ValidationError,
  VALIDATION_ERROR_NAME,
  dummyContext,
  testEnv,
  testHelpers,
  CognitoHelper,
  deleteCaseFileHandler,
  s3BatchJobStatusChangeHandler,
  S3BatchEventBridgeDetail,
  withAllowedOrigin,
};
