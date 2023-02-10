/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { logLevel } from "../logger"

describe('logger', () => {
    afterAll(() => {
        delete process.env.LOG_LEVEL;
    })
    it('uses a default level', () => {
        process.env.LOG_LEVEL = undefined;
        expect(logLevel()).toEqual('debug');
    });

    it('uses a specified level', () => {
        process.env.LOG_LEVEL = 'silly';
        expect(logLevel()).toEqual('silly');
    });
});