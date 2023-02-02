/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from "assert";
import Joi from "joi";
import { completeCaseFileUpload } from "../../../app/resources/complete-case-file-upload";
import { initiateCaseFileUpload } from "../../../app/resources/initiate-case-file-upload";
import { DeaCaseFile } from "../../../models/case-file";
import { caseResponseSchema } from "../../../models/validation/case";
import { ModelRepositoryProvider } from "../../../persistence/schema/entities";
import { dummyContext, dummyEvent } from "../../integration-objects";
import { getTestRepositoryProvider } from "./get-test-repository";

let repositoryProvider: ModelRepositoryProvider;

const FILE_NAME = "fileName";
const CASE_ULID = "ABCDEFGHHJKKMNNPQRSTTVWXYZ";
const FILE_ULID = "ABCDEFGHHJKKMNNPQRSTTVWXY9";
const FILE_PATH = "/food/sushi/";
const PRECEEDING_DIRECTORY_ULID = "9BCDEFGHHJKKMNNPQRSTTVWXYZ";
const UPLOAD_ID = "123456";
const SHA256_HASH = "030A1D0D2808C9487C6F4F67745BD05A298FDF216B8BFDBFFDECE4EFF02EBE0B";
const FILE_SIZE_MB = 50;
const FILE_TYPE = "image/jpeg";

describe('Test case file upload', () => {

    beforeAll(async () => {
        repositoryProvider = await getTestRepositoryProvider('CaseFileUploadTest');
    });

    afterAll(async () => {
        await repositoryProvider.table.deleteTable('DeleteTableForever');
    });

    it('should successfully complete a file upload', async () => {
        const caseFile: DeaCaseFile = await initiateCaseFileUploadAndValidate();
        completeCaseFileUploadAndValidate(caseFile.ulid);
    });

});

async function initiateCaseFileUploadAndValidate (
    fileName: string = FILE_NAME,
    caseUlid: string = CASE_ULID,
    filePath: string = FILE_PATH,
    fileType: string = FILE_TYPE,
    fileSizeMb: number = FILE_SIZE_MB,
    preceedingDirectoryUlid: string = PRECEEDING_DIRECTORY_ULID): Promise<DeaCaseFile> {

    const event = Object.assign({}, {
        ...dummyEvent,
        body: JSON.stringify({
            caseUlid,
            fileName,
            filePath,
            preceedingDirectoryUlid,
            fileType,
            fileSizeMb
        }),
    });
    const response = await initiateCaseFileUpload(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
        fail();
    }

    const newCaseFile: DeaCaseFile = JSON.parse(response.body);

    // Joi.assert(newCase, caseResponseSchema);
    expect(newCaseFile.fileName).toEqual(FILE_NAME);
    expect(newCaseFile.caseUlid).toEqual(CASE_ULID);
    expect(newCaseFile.filePath).toEqual(FILE_PATH);
    expect(newCaseFile.preceedingDirectoryUlid).toEqual(PRECEEDING_DIRECTORY_ULID);

    return newCaseFile;
}

async function completeCaseFileUploadAndValidate(
    ulid: string = FILE_ULID,
    fileName: string = FILE_NAME,
    caseUlid: string = CASE_ULID,
    filePath: string = FILE_PATH,
    uploadId: string = UPLOAD_ID,
    sha256Hash: string = SHA256_HASH,
    preceedingDirectoryUlid: string = PRECEEDING_DIRECTORY_ULID): Promise<void> {

    const event = Object.assign({}, {
        ...dummyEvent,
        body: JSON.stringify({
            caseUlid,
            fileName,
            filePath,
            preceedingDirectoryUlid,
            uploadId,
            sha256Hash,
            ulid
        }),
    });
    const response = await completeCaseFileUpload(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
        fail();
    }

    const newCaseFile: DeaCaseFile = JSON.parse(response.body);

    // Joi.assert(newCase, caseResponseSchema);
    expect(newCaseFile.fileName).toEqual(FILE_NAME);
    expect(newCaseFile.caseUlid).toEqual(CASE_ULID);
    expect(newCaseFile.filePath).toEqual(FILE_PATH);
    expect(newCaseFile.preceedingDirectoryUlid).toEqual(PRECEEDING_DIRECTORY_ULID);
}
