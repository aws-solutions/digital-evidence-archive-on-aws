/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Icon, Spinner } from '@cloudscape-design/components';
import SideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useAvailableEndpoints } from '../api/auth';
import { getSystemAuditCSV } from '../api/cases';
import { auditLogLabels, navigationLabels } from '../common/labels';
import { useNotifications } from '../context/NotificationsContext';

export interface NavigationProps {
  initialHref?: string;
  header?: SideNavigationProps.Header;
  onFollowHandler?: (ev: CustomEvent<SideNavigationProps.FollowDetail>) => void;
}

const MY_CASES_ENDPOINT = '/cases/my-casesGET';
const ALL_CASES_ENDPOINT = '/cases/all-casesGET';
const SYSTEM_AUDIT_ENDPOINT = '/system/auditPOST';
const DATA_VAULTS_ENDPOINT = '/datavaultsGET';

export default function Navigation({ initialHref }: NavigationProps): JSX.Element {
  const router = useRouter();

  const [activeHref, setActiveHref] = useState(initialHref);
  const [downloadInProgress, setDownloadInProgress] = useState(false);
  const { pushNotification } = useNotifications();

  const availableEndpoints = useAvailableEndpoints();
  if (availableEndpoints.isLoading) {
    return <Spinner />;
  }

  const navItems: SideNavigationProps.Item[] = [];
  if (availableEndpoints.data?.includes(MY_CASES_ENDPOINT)) {
    navItems.push({ type: 'link', text: navigationLabels.myCasesLabel, href: '/' });
  }

  if (availableEndpoints.data?.includes(ALL_CASES_ENDPOINT)) {
    navItems.push({ type: 'link', text: navigationLabels.allSystemCasesLabel, href: '/all-cases' });
  }

  if (availableEndpoints.data?.includes(DATA_VAULTS_ENDPOINT)) {
    navItems.push({ type: 'link', text: navigationLabels.dataVaultsLabel, href: '/data-vaults' });
  }

  const downloadSystemAudit = async () => {
    setDownloadInProgress(true);
    try {
      const csvDownloadUrl = await getSystemAuditCSV();
      const downloadDate = new Date();
      const alink = document.createElement('a');
      alink.href = csvDownloadUrl;
      alink.download = `SystemAudit_${downloadDate.getFullYear()}_${
        downloadDate.getMonth() + 1
      }_${downloadDate.getDate()}_H${downloadDate.getHours()}.csv`;
      alink.click();
    } catch (e) {
      pushNotification('error', auditLogLabels.errorLabel);
    } finally {
      setDownloadInProgress(false);
    }
  };

  navItems.push(
    { type: 'divider' },
    {
      type: 'link',
      text: navigationLabels.documentationLabel,
      href: 'https://aws.amazon.com/solutions/implementations/digital-evidence-archive-on-aws',
      external: true,
    }
  );

  if (availableEndpoints.data?.includes(SYSTEM_AUDIT_ENDPOINT)) {
    navItems.push({
      type: 'link',
      text: navigationLabels.systemAuditLogsLabel,
      href: '#',
      info: downloadInProgress ? <Spinner /> : <Icon name="download" />,
    });
  }

  return (
    <SideNavigation
      data-testid="sideNavigation"
      activeHref={activeHref}
      onFollow={async (event) => {
        if (!event.detail.external) {
          event.preventDefault();
          if (event.detail.text === navigationLabels.systemAuditLogsLabel) {
            if (downloadInProgress) {
              return;
            }
            await downloadSystemAudit();
          }
          setActiveHref(event.detail.href);
          return router.push(event.detail.href);
        }
      }}
      items={navItems}
    />
  );
}
