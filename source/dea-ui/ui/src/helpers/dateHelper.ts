/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

function formatDateFromISOString(isoString: string | undefined, locale = 'en-us'): string {
  if (!isoString) {
    return '-';
  }

  return formatDate(new Date(isoString), locale);
}

function formatDate(date: Date, locale = 'en-us'): string {
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export { formatDateFromISOString, formatDate };
