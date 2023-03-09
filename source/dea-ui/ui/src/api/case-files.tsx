/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaCaseFile } from '@aws/dea-app';
import { httpApiPost, httpApiPut } from '../helpers/apiHelper';
import { InitiateUploadForm, CompleteUploadForm } from '../models/CaseFiles';

const initiateUpload = async (apiInput: InitiateUploadForm): Promise<DeaCaseFile> => {
  const response = await httpApiPost(`cases/${apiInput.caseUlid}/files`, { ...apiInput });
  return response;
};

const completeUpload = async (apiInput: CompleteUploadForm): Promise<DeaCaseFile> => {
  const response = await httpApiPut(`cases/${apiInput.caseUlid}/files/${apiInput.ulid}`, { ...apiInput });
  return response;
};

export { initiateUpload, completeUpload };
