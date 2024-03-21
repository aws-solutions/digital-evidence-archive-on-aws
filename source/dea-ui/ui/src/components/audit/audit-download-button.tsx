/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Button, Spinner } from '@cloudscape-design/components';
import * as React from 'react';
import { auditLogLabels } from '../../common/labels';
import { useNotifications } from '../../context/NotificationsContext';

export interface AuditDownloadProps {
  permissionCallback: () => boolean;
  downloadCallback: () => Promise<string>;
  type: string;
  targetName: string;
  label: string;
  testId: string;
}

export function AuditDownloadButton(props: AuditDownloadProps): JSX.Element {
  const [downloadInProgress, setDownloadInProgress] = React.useState(false);
  const { pushNotification } = useNotifications();
  return (
    <Button
      data-testid={props.testId}
      disabled={downloadInProgress || !props.permissionCallback()}
      onClick={async () => {
        setDownloadInProgress(true);
        try {
          await downloadAudit(props.downloadCallback, props.type, props.targetName);
        } catch (e) {
          pushNotification('error', auditLogLabels.downloadAuditFail(props.targetName));
        } finally {
          setDownloadInProgress(false);
        }
      }}
    >
      {props.label}
      {downloadInProgress ? <Spinner /> : null}
    </Button>
  );
}

const downloadAudit = async (downloadCallback: () => Promise<string>, type: string, targetName: string) => {
  const csvDownloadUrl = await downloadCallback();
  const downloadDate = new Date();
  const alink = document.createElement('a');
  alink.href = csvDownloadUrl;
  alink.download = `${type}_${targetName}_${downloadDate.getFullYear()}_${
    downloadDate.getMonth() + 1
  }_${downloadDate.getDate()}_H${downloadDate.getHours()}.csv`;
  alink.click();
};
