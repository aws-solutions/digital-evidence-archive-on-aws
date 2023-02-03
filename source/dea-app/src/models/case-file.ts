/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaCaseFile {
    readonly caseUlid: string;
    readonly fileName: string;
    readonly ulid?: string; // ulid will not exist before case-file is persisted
    readonly fileSizeMb?: number;
    readonly preSignedUrls?: [string];
    readonly filePath?: string;
    readonly preceedingDirectoryUlid?: string;
    readonly fileType?: string;
    readonly uploadId?: string;
    readonly sha256Hash?: string;
    readonly contentPath?: string;
    readonly created?: Date;
    readonly updated?: Date;
}
