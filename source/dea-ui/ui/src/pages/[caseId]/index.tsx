/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import { useRouter } from 'next/router';
import BaseLayout from '../../components/BaseLayout';
import CaseDetailsBody from '../../components/case-details/CaseDetailsBody';

export interface IHomeProps {
  locale: string;
}

function CaseDetailsPage() {
  const router = useRouter();
  const { caseId } = router.query;
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

  return (
    <BaseLayout breadcrumbs={breadcrumbs} navigationHide>
      <Box margin={{ bottom: 'l' }}>
        <CaseDetailsBody caseId={caseId}></CaseDetailsBody>
      </Box>
    </BaseLayout>
  );
}

export default CaseDetailsPage;
