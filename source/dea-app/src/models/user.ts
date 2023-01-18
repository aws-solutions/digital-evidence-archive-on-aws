/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface DeaUser {
    readonly ulid?: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly created?: Date;
    readonly updated?: Date;
}