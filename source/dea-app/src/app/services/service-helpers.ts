/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export async function retry<T>(fn: () => Promise<T>, retries = 10, interval = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i < retries - 1) {
        // Random backoff
        const delayInMs = interval + randInt(0, 50);
        await sleep(delayInMs);
      } else {
        throw e;
      }
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1) + min);
