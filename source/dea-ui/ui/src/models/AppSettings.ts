/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export enum Language {
  en = 'en',
  es = 'es',
  pt = 'pt',
}

export interface IAppSettings {
  language: Language;
  logo: string;
  favicon: string;
  name: string;
  stage: string;
  slogan?: string;
  description?: string;
}

export const defaultAppSettings: IAppSettings = {
  language: Language.en,
  logo: 'logo.svg',
  favicon: 'favicon.svg',
  name: 'Digital Evidence Archive on AWS',
  slogan: 'Better ingredients better evidence',
  description:
    'The Digital Evidence Archive is the perfect place to store all your evidence and pizza toppings.',
  stage: 'test',
};
