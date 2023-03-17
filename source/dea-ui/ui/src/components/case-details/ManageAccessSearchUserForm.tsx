/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaUser } from '@aws/dea-app/lib/models/user';
import {
  Autosuggest,
  Button,
  Form,
  FormField,
  Grid,
  Icon,
  Popover,
  TextContent,
} from '@cloudscape-design/components';
import { useState } from 'react';
import { useGetUsers } from '../../api/cases';
import { commonLabels, manageCaseAccessLabels } from '../../common/labels';

export interface ManageAccessSearchUserFormProps {
  readonly onChange: (user: DeaUser) => void;
}

function ManageAccessSearchUserForm(props: ManageAccessSearchUserFormProps): JSX.Element {
  const { onChange } = props;
  const [filteringText, setFilteringText] = useState('');
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState('');
  const { data, isLoading } = useGetUsers(filteringText);

  function handleLoadItems(event: {
    detail: { filteringText: string; firstPage: boolean; samePage: boolean };
  }) {
    if (isLoading) {
      // there is another request in progress, discard this request.
      return;
    }
    setFilteringText(event.detail.filteringText);
  }

  function onSubmitHandler() {
    const user = data.find((user) => `${user.firstName} ${user.lastName}` === value);
    if (user) {
      onChange(user);
      setValue('');
    }
  }

  return (
    <Form>
      <FormField
        stretch={true}
        description={manageCaseAccessLabels.manageAccessDescription}
        label={manageCaseAccessLabels.manageAccessSearchLabel}
        info={
          <Popover
            position="bottom"
            triggerType="custom"
            content={
              <TextContent>
                <h5>{manageCaseAccessLabels.manageAccessSearchInfoHeader}</h5>
                <strong>{manageCaseAccessLabels.manageAccessSearchInfoLabel}</strong>
                <p>{manageCaseAccessLabels.manageAccessSearchInfoDescription}</p>
              </TextContent>
            }
          >
            <Icon name="status-info" variant="link" />
          </Popover>
        }
      >
        <Grid gridDefinition={[{ colspan: { default: 12, xs: 10 } }, { colspan: { default: 12, xs: 2 } }]}>
          <Autosuggest
            data-testid="user-search-input"
            value={value}
            enteredTextLabel={(value) => manageCaseAccessLabels.searchAutosuggestEnteredText(value)}
            ariaLabel={manageCaseAccessLabels.searchPlaceholder}
            placeholder={manageCaseAccessLabels.searchPlaceholder}
            empty={commonLabels.noMatchesLabel}
            loadingText={manageCaseAccessLabels.searchAutosuggestLoadingText}
            errorText={commonLabels.errorLabel}
            recoveryText={commonLabels.retryLabel}
            finishedText={manageCaseAccessLabels.searchAutosuggestFinishedText(filteringText)}
            statusType={isLoading ? 'pending' : 'finished'}
            options={data.map((user: DeaUser) => ({ value: `${user.firstName} ${user.lastName}` }))}
            filteringType="manual"
            onChange={({ detail }) => setValue(detail.value)}
            onLoadItems={handleLoadItems}
            onSelect={({ detail }) => setSelected(detail.value)}
          />
          <Button onClick={onSubmitHandler} disabled={selected !== value}>
            {commonLabels.addButton}
          </Button>
        </Grid>
      </FormField>
    </Form>
  );
}

export default ManageAccessSearchUserForm;
