/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { DeaCaseFile } from '../../models/case-file';
import * as CaseFilePersistence from '../../persistence/case-file';
import { defaultProvider } from '../../persistence/schema/entities';

export const initiateCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaCaseFile> => {
  // need to add a status to indicate if file has been uploaded or is pending
  // need to add a ttl to clear out incomplete case-files
  const caseFile: DeaCaseFile = await CaseFilePersistence.initiateCaseFileUpload(
    deaCaseFile,
    repositoryProvider
  );
  const s3Client = new S3Client({});
  const response = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: 'bucket',
      Key: getS3KeyForCaseFile(caseFile),
    })
  );

  return caseFile;
};

export const completeCaseFileUpload = async (
  deaCaseFile: DeaCaseFile,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider = defaultProvider
): Promise<DeaCaseFile> => {
  return await CaseFilePersistence.completeCaseFileUpload(deaCaseFile, repositoryProvider);
};

function getS3KeyForCaseFile(caseFile: DeaCaseFile): string {
  return `${caseFile.caseUlid}/${caseFile.ulid}`;
}
