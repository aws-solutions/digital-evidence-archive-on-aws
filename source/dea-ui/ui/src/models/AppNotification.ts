/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { FlashbarProps } from '@cloudscape-design/components';

export interface IAppNotification {
  id: string;
  type: FlashbarProps.Type;
  content: React.ReactNode;
}
