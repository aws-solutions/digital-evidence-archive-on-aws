/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Box, HelpPanel, Icon, Link, SpaceBetween } from '@cloudscape-design/components';
import React from 'react';
import { accessibilityLabels, commonTableLabels } from './labels';

export const helpPanelContent: Record<string, React.ReactNode> = {
  default: (
    <div>
      <SpaceBetween size="s" direction="vertical">
        <Box
          fontWeight="bold"
          color="text-body-secondary"
          textAlign="center"
          margin={{ top: 'xxl', horizontal: 'xxl' }}
          fontSize="body-m"
        >
          No help content to show
        </Box>
        <Box color="text-body-secondary" textAlign="center" margin={{ horizontal: 'xxl' }} fontSize="body-m">
          There is no additional help content on this page. See{' '}
          <>
            <Link
              external
              ariaLabel={accessibilityLabels.implementationGuideLinkLabel}
              href="https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html"
            >
              {commonTableLabels.implementationGuideLabel}
            </Link>
            .
          </>
        </Box>
      </SpaceBetween>
    </div>
  ),
  'case-details-page': (
    <HelpPanel
      header={'Case details page'}
      footer={
        <>
          <h3>
            Learn more{' '}
            <span role="img" aria-label="Links open in a new tab">
              <Icon name="external" size="inherit" />
            </span>
          </h3>
          <Link
            ariaLabel={accessibilityLabels.implementationGuideLinkLabel}
            href="https://docs.aws.amazon.com/solutions/latest/digital-evidence-archive-on-aws/overview.html"
          >
            {commonTableLabels.implementationGuideLabel}
          </Link>
        </>
      }
    >
      <div>
        <p>
          This page displays case details, evidence files, and user permissions associated with the case. Some
          options on the page may not be available as user permissions are set by the case creator.
        </p>
      </div>
    </HelpPanel>
  ),
  'search-for-people': (
    <HelpPanel header={"Can't find someone?"}>
      <div>
        <p>Reach out to your administrator and request a new user to be invited to the system.</p>
      </div>
    </HelpPanel>
  ),
};
