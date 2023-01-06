/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Settings from './settings';

export default class Setup {
    private _stage: string;
    private _settings: Settings;

    public constructor() {
        this._stage = 'ohio'; //process.env['stage'];
        this._settings = new Settings(this._stage);
    }

    public getSettings(): Settings {
        return this._settings;
    }
}