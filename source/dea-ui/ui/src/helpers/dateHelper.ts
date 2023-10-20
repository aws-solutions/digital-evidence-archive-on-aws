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

function formatDate(date: Date | undefined, locale = 'en-us'): string {
  if (!date) {
    return '-';
  }
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTimeFromISOString(isoString: string | undefined, locale = 'en-us'): string {
  if (!isoString) {
    return '-';
  }

  return formatDateTime(new Date(isoString), locale);
}

function formatDateTime(date: Date | undefined, locale = 'en-us'): string {
  if (!date) {
    return '-';
  }
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZoneName: 'short',
    formatMatcher: 'basic',
  });
}

export { formatDateFromISOString, formatDate, formatDateTimeFromISOString, formatDateTime };
