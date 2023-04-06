/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

function formatDateFromISOString(isoString: string, locale = 'en-us'): string {
  return formatDate(!isoString ? undefined : new Date(isoString), locale);
}

function formatDate(date: Date | undefined, locale = 'en-us'): string {
  if (!date) {
    return '-';
  }
  return date
    .toLocaleString(locale, {
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
    .toUpperCase();
}

export { formatDateFromISOString, formatDate };
