/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export const isDefined = <T>(item: T | undefined): item is T => {
    return !!item;
};