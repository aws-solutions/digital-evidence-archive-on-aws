/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Box, BreadcrumbGroupProps } from '@cloudscape-design/components';
import { getBaseProps } from '@cloudscape-design/components/internal/base-component';

import type { GetStaticPaths, NextPage } from 'next';
import BaseLayout from '../../components/BaseLayout';
import CaseDetailsBody from '../../components/CaseDetailsBody';

export interface IHomeProps {
  locale: string;
}

function CaseDetailsPage(props: { caseId: string }) {
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
        <CaseDetailsBody caseId={props.caseId}></CaseDetailsBody>
      </Box>
    </BaseLayout>
  );
}

export async function getStaticPaths() {
  return {
    paths: [], //indicates that no page needs be created at build time
    fallback: 'blocking', //indicates the type of fallback
  };
}

export async function getStaticProps(context: { params: { caseId: string } }) {
  const caseId = context.params.caseId;
  console.log('id is ' + caseId);
  return {
    props: { caseId: caseId }, // will be passed to the page component as props
    revalidate: 10, // In seconds
  };
}

export default CaseDetailsPage;
