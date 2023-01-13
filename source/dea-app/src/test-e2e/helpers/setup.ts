/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import Settings from './settings';

export default class Setup {
  private _settings: Settings;

  public constructor() {
    // If the IS_LOCAL_DEA_TESTING is set in env variables
    // load settings from the yaml file, otherwise
    // read from the env variables
    if (process.env['IS_LOCAL_DEA_TESTING']) {
      const stage = process.env['STAGE'] ?? 'test';
      this._settings = new Settings(stage);
    } else {
      this._settings = new Settings();
    }
  }

  public getSettings(): Settings {
    return this._settings;
  }
}
