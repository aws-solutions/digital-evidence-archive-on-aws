/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from "./case-action";

export interface CaseUser {
    readonly caseUlid: string;
    readonly userUlid: string;
    readonly actions: CaseAction[];
    readonly caseName: string;
    readonly userFirstName: string;
    readonly userLastName: string;
    readonly created?: Date;
    readonly updated?: Date;
}