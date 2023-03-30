/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { BreadcrumbGroupProps } from '@cloudscape-design/components';
import BaseLayout from '../../components/BaseLayout';

export default function ManageCasePage() {
  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: 'Digital Evidence Archive',
      href: '#',
    },
    {
      text: 'Login',
      href: '#',
    },
  ];
  return <BaseLayout breadcrumbs={breadcrumbs}>{'¯\\_(ツ)_/¯'}</BaseLayout>;
}
