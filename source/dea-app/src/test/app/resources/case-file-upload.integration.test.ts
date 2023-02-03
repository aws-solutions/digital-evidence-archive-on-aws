/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from "assert";
import { completeCaseFileUpload } from "../../../app/resources/complete-case-file-upload";
import { initiateCaseFileUpload } from "../../../app/resources/initiate-case-file-upload";
import { DeaCaseFile } from "../../../models/case-file";
import { ModelRepositoryProvider } from "../../../persistence/schema/entities";
import { dummyContext, dummyEvent } from "../../integration-objects";
import { getTestRepositoryProvider } from "./get-test-repository";

let repositoryProvider: ModelRepositoryProvider;

const FILE_NAME = "fileName";
const CASE_ULID = "ABCDEFGHHJKKMNNPQRSTTVWXYZ";
const FILE_ULID = "ABCDEFGHHJKKMNNPQRSTTVWXY9";
const FILE_PATH = "/food/sushi/";
const PRECEDING_DIRECTORY_ULID = "9BCDEFGHHJKKMNNPQRSTTVWXYZ";
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
        await completeCaseFileUploadAndValidate(caseFile.ulid);
    });

    it('should throw a validation exception when no payload is provided', async () => {
        await expect(initiateCaseFileUpload(dummyEvent, dummyContext, repositoryProvider)).rejects.toThrow('Initiate case file upload payload missing.');
        await expect(completeCaseFileUpload(dummyEvent, dummyContext, repositoryProvider)).rejects.toThrow('Complete case file upload payload missing.');
    });

    it('initiate upload should enforce a strict payload', async () => {
        // validate caseUlid
        await expect(initiateCaseFileUploadAndValidate('ABCD')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate('')).rejects.toThrow();

        // validate fileName
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'abc>ff')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'abc<ff')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'abc:ff')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'abc|ff')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'abc?ff')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'abc*ff')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, '')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, '/food/ramen.jpg')).rejects.toThrow();

        // allowed fileNames
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'ramen.jpg'));
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'ramen-jpg'));
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'ramen_jpg'));
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, 'ramen jpg'));

        // validate filePath
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, 'foo')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, '')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, 'foo\\')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, 'foo&&')).rejects.toThrow();

        // allowed filePaths
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, '/'));
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, '/foo/'));
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, '/foo/bar/'));

        // validate fileSizeMb
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, FILE_TYPE, 0)).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, FILE_TYPE, -1)).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, FILE_TYPE, 5_000_001)).rejects.toThrow();

        // allowed fileSizeMb
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, FILE_TYPE, 4_999_999));
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, FILE_TYPE, 1));

        // validate precedingDirectoryUlid
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, FILE_TYPE, FILE_SIZE_MB, 'ABC')).rejects.toThrow();
        await expect(initiateCaseFileUploadAndValidate(CASE_ULID, FILE_NAME, FILE_PATH, FILE_TYPE, FILE_SIZE_MB, '')).rejects.toThrow();
    });

});

async function initiateCaseFileUploadAndValidate (
    caseUlid: string = CASE_ULID,
    fileName: string = FILE_NAME,
    filePath: string = FILE_PATH,
    fileType: string = FILE_TYPE,
    fileSizeMb: number = FILE_SIZE_MB,
    precedingDirectoryUlid: string = PRECEDING_DIRECTORY_ULID): Promise<DeaCaseFile> {

    const event = Object.assign({}, {
        ...dummyEvent,
        body: JSON.stringify({
            caseUlid,
            fileName,
            filePath,
            precedingDirectoryUlid,
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
    expect(newCaseFile.fileName).toEqual(fileName);
    expect(newCaseFile.caseUlid).toEqual(caseUlid);
    expect(newCaseFile.filePath).toEqual(filePath);
    expect(newCaseFile.precedingDirectoryUlid).toEqual(precedingDirectoryUlid);

    return newCaseFile;
}

async function completeCaseFileUploadAndValidate(
    ulid: string = FILE_ULID,
    caseUlid: string = CASE_ULID,
    fileName: string = FILE_NAME,
    filePath: string = FILE_PATH,
    uploadId: string = UPLOAD_ID,
    sha256Hash: string = SHA256_HASH,
    precedingDirectoryUlid: string = PRECEDING_DIRECTORY_ULID): Promise<void> {

    const event = Object.assign({}, {
        ...dummyEvent,
        body: JSON.stringify({
            caseUlid,
            fileName,
            filePath,
            precedingDirectoryUlid: precedingDirectoryUlid,
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
    expect(newCaseFile.fileName).toEqual(fileName);
    expect(newCaseFile.caseUlid).toEqual(caseUlid);
    expect(newCaseFile.filePath).toEqual(filePath);
    expect(newCaseFile.precedingDirectoryUlid).toEqual(precedingDirectoryUlid);
}
