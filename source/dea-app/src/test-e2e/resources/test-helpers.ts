/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import fetch from 'node-fetch';

export async function deleteCase(baseUrl: string, caseUlid: string): Promise<void> {
  const response = await fetch(`${baseUrl}cases/${caseUlid}`, {
    method: 'DELETE',
    headers: {
      authorization: 'allow',
    },
  });

  expect(response.ok).toBeTruthy();
}
