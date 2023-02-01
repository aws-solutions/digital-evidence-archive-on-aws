/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Container, FormField, Header, Input } from '@cloudscape-design/components';
import * as React from 'react';
import { manageCaseAccessLabels } from '../../common/labels';

function ManageAccessForm() {
  const [inputValue, setInputValue] = React.useState('');
  return (
    <Container data-testid="manage-access-container" header={<Header variant="h2">{manageCaseAccessLabels.manageCaseAccessLabel}</Header>}>
      <FormField
        description={manageCaseAccessLabels.manageAccessDescription}
        label={manageCaseAccessLabels.manageAccessSearchLabel}
      >
        <Input data-testid="manage-access-input" value={inputValue} onChange={(event) => setInputValue(event.detail.value)} />
      </FormField>
    </Container>
  );
}

export default ManageAccessForm;