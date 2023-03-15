/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as CompleteCaseFileUploadHandler from '../../handlers/complete-case-file-upload-handler';
import * as CreateCaseUserHandler from '../../handlers/create-case-user-handler';
import * as CreateCasesHandler from '../../handlers/create-cases-handler';
import * as DeleteCasesHandler from '../../handlers/delete-case-handler';
import * as DeleteCaseUserHandler from '../../handlers/delete-case-user-handler';
import * as DownloadCaseFileHandler from '../../handlers/download-case-file-handler';
import * as GetAllCasesHandler from '../../handlers/get-all-cases-handler';
import * as GetCaseDetailHandler from '../../handlers/get-case-detail-handler';
import * as GetCaseFileDetailHandler from '../../handlers/get-case-file-detail-handler';
import * as GetCaseMembershipHandler from '../../handlers/get-case-membership-handler';
import * as GetCredentialsHandler from '../../handlers/get-credentials-handler';
import * as GetLoginUrlHandler from '../../handlers/get-login-url-handler';
import * as GetLogoutUrlHandler from '../../handlers/get-logout-url-handler';
import * as GetMyCasesHandler from '../../handlers/get-my-cases-handler';
import * as GetTokenHandler from '../../handlers/get-token-handler';
import * as GetUsersHandler from '../../handlers/get-users-handler';
import * as InitiateCaseFileUploadHandler from '../../handlers/initiate-case-file-upload-handler';
import * as ListCaseFilesHandler from '../../handlers/list-case-files-handler';
import * as RevokeTokenHandler from '../../handlers/revoke-token-handler';
import * as UpdateCaseUserHandler from '../../handlers/update-case-user-handler';
import * as UpdateCasesHandler from '../../handlers/update-cases-handler';

describe('lambda handlers', () => {
  it('should be wrapped with the deaHandler', () => {
    const handlers = [
      CreateCasesHandler.handler,
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
      GetCredentialsHandler.handler,
      GetTokenHandler.handler,
      RevokeTokenHandler.handler,
      GetUsersHandler.handler,
      UpdateCaseUserHandler.handler,
      GetCaseMembershipHandler.handler,
    ];

    handlers.forEach((handler) => {
      expect(typeof handler === 'function').toBeTruthy();
    });
  });
});
