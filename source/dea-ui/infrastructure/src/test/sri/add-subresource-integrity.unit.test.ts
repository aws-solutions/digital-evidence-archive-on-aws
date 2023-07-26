/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { generateSri } from '../../generate-subresource-integrity';

describe('addsri', () => {
  it('calculate integrity hashes', () => {
    const sriArray = generateSri('./src/test/sri/', 'sha384');

    expect(sriArray.join('')).toEqual(
      'sha384-qCm5kqE3cGJ/89mY9eVIhR052I7x4CsSarEUcoGhpz+Tn7jaS7nHoWxlqNGoKHBO'
    );
  });
});
