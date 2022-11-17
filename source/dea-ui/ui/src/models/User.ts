/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { IconProps } from '@cloudscape-design/components/icon';

export interface IUser {
  id: string;
  name: string;
  email: string;
  avatar: IconProps;
  claims: string[];
}

export const unknownUser: IUser = {
  id: 'sample-id',
  name: 'Sample User',
  email: 'sample.user@amazon.com',
  avatar: { name: 'user-profile' },
  claims: [],
};
