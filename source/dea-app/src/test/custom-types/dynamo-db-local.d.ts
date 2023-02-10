/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { ChildProcess } from "child_process";

declare module 'dynamo-db-local';

export declare class DbLocal {
    spawn({port: number}): ChildProcess;
}
export declare const dbLocal: DbLocal
export default dbLocal