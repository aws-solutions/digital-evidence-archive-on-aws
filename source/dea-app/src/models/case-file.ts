/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseStatus } from './case-status';

export interface DeaCaseFile {
    readonly caseUlid: string;
    readonly name: string;
    readonly sizeMb: number;
    readonly filePath?: string;
    readonly preceedingDirectoryUlid: string;
    readonly fileType?: string;
    readonly uploadId?: string;
    readonly sha256Hash?: string;
    readonly ulid?: string;
    readonly contentPath?: string;
    readonly created?: Date;
    readonly updated?: Date;
}
