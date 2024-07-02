/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import NodeCache from 'node-cache';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export interface CacheProvider {
  set<T>(key: string, value: T, ttl?: number): void;
  get<T>(key: string, getter: () => Promise<T>): Promise<T>;
}

// TODO: Explore Serverless Elasticache once it becomes available in gov cloud
export const createCacheProvider = (cache: NodeCache): CacheProvider => {
  return {
    set<T>(key: string, value: T, ttl?: number) {
      if (ttl) {
        cache.set(key, value, ttl);
      }
      cache.set(key, value);
    },
    async get<T>(key: string, getter: () => Promise<T>, ttl?: number): Promise<T> {
      const maybeVal = cache.get<T>(key);
      if (maybeVal) {
        return maybeVal;
      }

      const val = await getter();
      this.set(key, val, ttl);
      return val;
    },
  };
};

export const defaultCacheProvider: CacheProvider = createCacheProvider(
  new NodeCache({
    stdTTL: DEFAULT_TTL,
    useClones: false,
    deleteOnExpire: true,
  })
);
