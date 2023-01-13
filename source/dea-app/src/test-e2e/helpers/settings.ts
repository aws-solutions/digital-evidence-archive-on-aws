/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import _ from 'lodash';

interface Setting {
  // Main CFN template outputs
  awsRegion: string;
  apiUrlOutput: string;
  clientId: string;
  userPoolId: string;
  identityPoolId: string;
}

export type SettingKey = keyof Setting;

/**
 * All settings used during the tests are stored here. The main advantage of having to use get/set methods
 * when accessing settings values is so that we can print an informative message when keys are missing.
 */
export default class Settings {
  private _content: Setting;

  public constructor(stageName?: string) {
    if (stageName) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = yaml.load(
        // __dirname is a variable that reference the current directory. We use it so we can dynamically navigate to the
        // correct file
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.readFileSync(join(__dirname, `../../../../dea-backend/src/config/${stageName}.yaml`), 'utf8') // nosemgrep
      );

      this._content = _.cloneDeep(config);
    } else {
      // Read from env variables
      this._content = {
        awsRegion: process.env.AWS_REGION ?? 'us-east-1',
        apiUrlOutput: process.env['DEA_API_URL'] as string,
        identityPoolId: process.env['IDENTITY_POOL_ID'] as string,
        userPoolId: process.env['USER_POOL_ID'] as string,
        clientId: process.env['USER_POOL_CLIENT_ID'] as string,
      };
    }
  }

  public get entries(): Setting {
    return _.cloneDeep(this._content);
  }

  public set(key: SettingKey, value: string): void {
    // TODO: Prevent updating main CFN output values
    this._content[key] = value;
  }

  public get(key: SettingKey): string {
    const value = this._content[key];
    if (_.isEmpty(value) && !_.isBoolean(value))
      throw new Error(`The "${key}" setting value is required but it is either empty or not a boolean`);

    return value;
  }

  public optional(key: SettingKey, defaultValue?: string): string | undefined {
    const value = this._content[key];
    if (_.isNil(value) || (_.isString(value) && _.isEmpty(value))) return defaultValue;

    return value;
  }
}

module.exports = Settings;
