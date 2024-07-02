/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DeaUser } from '@aws/dea-app/lib/models/user';
import { Autosuggest, Button, Form, FormField, Grid, Link } from '@cloudscape-design/components';
import { useState } from 'react';
import { useGetUsers } from '../../api/cases';
import { commonLabels, manageCaseAccessLabels } from '../../common/labels';
import { useHelp } from '../../context/HelpContext';

export interface ManageAccessSearchUserFormProps {
  readonly onChange: (user: DeaUser) => void;
}

function ManageAccessSearchUserForm(props: ManageAccessSearchUserFormProps): JSX.Element {
  const { onChange } = props;
  const [filteringText, setFilteringText] = useState('');
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState('');
  const { data, isLoading } = useGetUsers(filteringText);
  const { makeHelpPanelHandler } = useHelp();

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
        data-testid="manage-access-search-user-form-combobox"
        info={<Link onFollow={makeHelpPanelHandler('search-for-people')}>{commonLabels.infoLabel}</Link>}
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
            ariaDescribedby={data.map((user: DeaUser) => `${user.firstName}-${user.lastName}`).join(' ')}
            clearAriaLabel={commonLabels.clearLabel}
          />
          <Button
            ariaLabel={commonLabels.addButton}
            onClick={onSubmitHandler}
            disabled={!selected || selected !== value}
          >
            {commonLabels.addButton}
          </Button>
        </Grid>
      </FormField>
    </Form>
  );
}

export default ManageAccessSearchUserForm;
