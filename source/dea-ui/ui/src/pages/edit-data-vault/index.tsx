/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import type { NextPage } from 'next';
import { useRouter } from 'next/router';
import { breadcrumbLabels, commonLabels, navigationLabels } from '../../common/labels';
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
  const { dataVaultId, dataVaultName } = router.query;

  const baseUrl = isUsingCustomDomain ? `/ui` : `/${settings.stage}/ui`;

  const pageName = navigationLabels.editDataVaultLabel;

  if (
    !dataVaultId ||
    typeof dataVaultId !== 'string' ||
    !dataVaultName ||
    typeof dataVaultName !== 'string'
  ) {
    return <h1>{commonLabels.notFoundLabel}</h1>;
  }

  const breadcrumbs: BreadcrumbGroupProps.Item[] = [
    {
      text: breadcrumbLabels.dataVaultsLabel,
      href: `${baseUrl}/data-vaults`,
    },
    {
      text: dataVaultName,
      href: `${baseUrl}/data-vault-detail?dataVaultId=${dataVaultId}`,
    },
    {
      text: breadcrumbLabels.editDataVaultLabel,
      href: '#',
    },
  ];

  return (
    <BaseLayout breadcrumbs={breadcrumbs} pageName={pageName}>
      <Box margin={{ bottom: 'l' }}>
        <EditDataVaultBody dataVaultId={dataVaultId} />
      </Box>
    </BaseLayout>
  );
};

export default EditDataVaultPage;
