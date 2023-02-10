/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Autosuggest, Container, Header, SpaceBetween, TextContent } from '@cloudscape-design/components';
import * as React from 'react';
import { commonLabels, createCaseLabels } from '../../common/labels';

function CreateCaseShareCaseForm(): JSX.Element {
  const [value, setValue] = React.useState('');

  return (
    <Container data-testid="share-form-container" header={<Header variant="h2">{createCaseLabels.shareCaseLabel}</Header>}>
      <SpaceBetween direction="vertical" size="l"></SpaceBetween>
      <TextContent>
        <p>
          <strong>{createCaseLabels.searchPeopleLabel}</strong>
          <br />
          <small>{createCaseLabels.searchPeopleDescription}</small>
        </p>
      </TextContent>
      <Autosuggest
        data-testid="share-form-auto-suggest"
        onChange={({ detail }) => setValue(detail.value)}
        value={value}
        options={[]}
        enteredTextLabel={(value) => `Use: "${value}"`}
        placeholder={createCaseLabels.searchPlaceholder}
        empty={commonLabels.noMatchesLabel}
      />
    </Container>
  );
}

export default CreateCaseShareCaseForm;
