/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

// convert a string to a boolean
export function strToBool(str: string | undefined): boolean {
  return str?.trim().toLowerCase() === 'true';
}

export const isUsingCustomDomain = strToBool(process.env.NEXT_PUBLIC_IS_USING_CUSTOM_DOMAIN);
