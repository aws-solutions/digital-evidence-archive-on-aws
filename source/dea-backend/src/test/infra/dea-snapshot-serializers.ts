/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { deaConfig } from '../../config';

export const addSnapshotSerializers = (): void => {
  expect.addSnapshotSerializer({
    test: (val) => typeof val === 'string' && val.includes('zip'),
    print: (val) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const newVal = (val as string).replace(/([A-Fa-f0-9]{64})/, '[HASH REMOVED]');
      return `"${newVal}"`;
    },
  });

  expect.addSnapshotSerializer({
    test: (val) => typeof val === 'string' && val.includes(deaConfig.stage()),
    print: (val) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const newVal1 = (val as string).replace(deaConfig.stage(), '[STAGE-REMOVED]');
      const newVal = newVal1.replace(/([A-Fa-f0-9]{8})/, '[HASH REMOVED]');
      return `"${newVal}"`;
    },
  });

  const domain = deaConfig.cognitoDomain();
  if (domain) {
    expect.addSnapshotSerializer({
      test: (val) => typeof val === 'string' && val.includes(domain),
      print: (val) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const newVal1 = (val as string).replace(domain, '[DOMAIN-REMOVED]');
        const newVal = newVal1.replace(/([A-Fa-f0-9]{8})/, '[HASH REMOVED]');
        return `"${newVal}"`;
      },
    });
  }
};
