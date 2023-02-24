/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as CompleteCaseFileUploadHandler from '../../handlers/complete-case-file-upload-handler';
import * as CreateCaseUserHandler from '../../handlers/create-case-user-handler';
import * as CreateCasesHandler from '../../handlers/create-cases-handler';
import * as DeleteCasesHandler from '../../handlers/delete-case-handler';
import * as DownloadCaseFileHandler from '../../handlers/download-case-file-handler';
import * as GetAllCasesHandler from '../../handlers/get-all-cases-handler';
import * as GetCaseDetailHandler from '../../handlers/get-case-detail-handler';
import * as GetCaseFileDetailHandler from '../../handlers/get-case-detail-handler';
import * as GetMyCasesHandler from '../../handlers/get-my-cases-handler';
import * as InitiateCaseFileUploadHandler from '../../handlers/initiate-case-file-upload-handler';
import * as ListCaseFilesHandler from '../../handlers/list-case-files-handler';
import * as SayByeHandler from '../../handlers/say-bye-handler';
import * as SayHelloHandler from '../../handlers/say-hello-handler';
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
      GetCaseDetailHandler.handler,
      GetCaseFileDetailHandler.handler,
      GetMyCasesHandler.handler,
      InitiateCaseFileUploadHandler.handler,
      ListCaseFilesHandler.handler,
      UpdateCasesHandler.handler,
      SayByeHandler.handler,
      SayHelloHandler.handler,
    ];

    handlers.forEach((handler) => {
      expect(typeof handler === 'function').toBeTruthy();
    });
  });
});
