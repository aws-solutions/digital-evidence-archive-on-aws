/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { breadcrumbLabels, commonLabels } from '../../common/labels';
import { isUsingCustomDomain } from '../../common/utility';
import BaseLayout from '../../components/BaseLayout';
import EditDataVaultBody from '../../components/edit-data-vault/EditDataVaultBody';
import { useSettings } from '../../context/SettingsContext';

export interface EditDataVaultPageProps {
  locale: string;
}

const EditDataVaultPage: NextPage = () => {
  const router = useRouter();
  const { settings } = useSettings();
  const { dataVaultId } = router.query;

  const href_prefix = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  if (!dataVaultId || typeof dataVaultId !== 'string') {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.dataVaultsLabel,
      href: `${href_prefix}/data-vaults`,
    },
    {
      text: breadcrumbLabels.dataVaultDetailsLabel,
      href: `${href_prefix}/data-vault-detail?dataVaultId=${dataVaultId}`,
    },
    {
      text: breadcrumbLabels.editCaseLabel,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide>
      <Box margin={{ bottom: 'l' }}>
        <EditDataVaultBody dataVaultId={dataVaultId} />
      </Box>
    </BaseLayout>
  );
};

export default EditDataVaultPage;
