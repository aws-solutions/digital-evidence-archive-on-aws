/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Icon, IconProps, Link, Select, SpaceBetween, TextContent } from '@cloudscape-design/components';
import { breadcrumbLabels } from '../../common/labels';
import styles from '../../styles/Breadcrumb.module.scss';

export interface BreadcrumbItem {
  label: string;
  value: string;
  iconName: IconProps.Name | undefined;
}

export interface BreadcrumbProps {
  breadcrumbItems: BreadcrumbItem[];
  'data-testid': string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick: (event: any) => void;
  filesTableState: object;
}

export default function Breadcrumb({
  filesTableState,
  breadcrumbItems,
  'data-testid': data_testId,
  onClick,
}: BreadcrumbProps): JSX.Element {
  const reversedBreadcrumb = breadcrumbItems.slice(1).reverse();

  if (breadcrumbItems.length === 1) {
    return (
      <SpaceBetween
        data-testid={`breadcrumb-length-${breadcrumbItems.length}`}
        direction="horizontal"
        size="xxs"
      >
        <span role="img" aria-label={breadcrumbLabels.breadcrumbIconLabel}>
          <Icon name="calendar" variant="disabled" />
        </span>
        <TextContent>
          <span className={styles['breadcrumb-disabled']}>{breadcrumbItems[0].label}</span>
        </TextContent>
      </SpaceBetween>
    );
  } else if (breadcrumbItems.length === 2) {
    return (
      <SpaceBetween
        data-testid={`breadcrumb-length-${breadcrumbItems.length}`}
        direction="horizontal"
        size="xxs"
      >
        <span role="img" aria-label={breadcrumbLabels.breadcrumbIconLabel}>
          <Icon name="calendar" variant="link" />
        </span>
        <Link
          href={breadcrumbItems[0].value}
          data-testid={data_testId}
          onFollow={onClick}
          ariaLabel={breadcrumbLabels.rootDescriptiveLabel}
        >
          <span>{breadcrumbItems[0].label}</span>
        </Link>
        <span role="img" aria-label={breadcrumbLabels.nextLevelIconLabel}>
          <Icon name="angle-right" size="inherit" variant="subtle" />
        </span>
        <TextContent>
          <span className={styles['breadcrumb-disabled']}>{breadcrumbItems[1].label}</span>
        </TextContent>
      </SpaceBetween>
    );
  } else if (breadcrumbItems.length === 3) {
    return (
      <SpaceBetween
        data-testid={`breadcrumb-length-${breadcrumbItems.length}`}
        direction="horizontal"
        size="xxs"
      >
        <span role="img" aria-label={breadcrumbLabels.breadcrumbIconLabel}>
          <Icon name="calendar" variant="link" />
        </span>
        <Link
          href={breadcrumbItems[0].value}
          data-testid={data_testId}
          onFollow={onClick}
          ariaLabel={breadcrumbLabels.rootDescriptiveLabel}
        >
          <span>{breadcrumbItems[0].label}</span>
        </Link>
        <span role="img" aria-label={breadcrumbLabels.nextLevelIconLabel}>
          <Icon name="angle-right" size="inherit" variant="subtle" />
        </span>
        <Link href={breadcrumbItems[1].value} onFollow={onClick} ariaLabel={breadcrumbItems[1].label}>
          <span>{breadcrumbItems[1].label}</span>
        </Link>
        <span role="img" aria-label={breadcrumbLabels.nextLevelIconLabel}>
          <Icon name="angle-right" size="inherit" variant="subtle" />
        </span>
        <TextContent>
          <span className={styles['breadcrumb-disabled']}>{breadcrumbItems[2].label}</span>
        </TextContent>
      </SpaceBetween>
    );
  } else {
    return (
      <SpaceBetween
        data-testid={`breadcrumb-length-${breadcrumbItems.length}`}
        direction="horizontal"
        size="xxs"
        alignItems="center"
      >
        <span role="img" aria-label={breadcrumbLabels.breadcrumbIconLabel}>
          <Icon name="calendar" variant="link" />
        </span>
        <Link
          href={breadcrumbItems[0].value}
          data-testid={data_testId}
          onFollow={onClick}
          ariaLabel={breadcrumbLabels.rootDescriptiveLabel}
        >
          <span>{breadcrumbItems[0].label}</span>
        </Link>
        <span role="img" aria-label={breadcrumbLabels.nextLevelIconLabel}>
          <Icon name="angle-right" size="inherit" variant="subtle" />
        </span>
        <div className={styles['breadcrumb-dropdown']}>
          <Select
            onChange={onClick}
            selectedOption={filesTableState}
            options={reversedBreadcrumb}
            ariaLabel={breadcrumbLabels.selectFileLevelDropdownLabel}
          />
        </div>
      </SpaceBetween>
    );
  }
}
