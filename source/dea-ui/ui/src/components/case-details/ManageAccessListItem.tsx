/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseAction } from '@aws/dea-app/lib/models/case-action';
import { CaseUser } from '@aws/dea-app/lib/models/case-user';
import {
  Button,
  ColumnLayout,
  FormField,
  Grid,
  Multiselect,
  MultiselectProps,
  SelectProps,
  TextContent,
} from '@cloudscape-design/components';
import { useState } from 'react';
import { caseActionOptions, commonLabels, manageCaseAccessLabels } from '../../common/labels';
import styles from '../../styles/ManageAccessListItem.module.scss';

export interface ManageAccessListItemProps {
  readonly caseMember: CaseUser;
  readonly onRemoveMember: (user: CaseUser) => Promise<void>;
  readonly onUpdateMember: (user: CaseUser) => Promise<void>;
}

function ManageAccessListItem(props: ManageAccessListItemProps): JSX.Element {
  const { caseMember, onRemoveMember, onUpdateMember } = props;
  const [selectedOptions, setSelectedOptions] = useState<ReadonlyArray<SelectProps.Option>>(
    caseMember.actions.map((action) => caseActionOptions.actionOption(action))
  );
  const [isRemoving, setIsRemoving] = useState(false);
  async function onPermissionsChangeHandler(event: {
    detail: MultiselectProps.MultiselectChangeDetail;
  }): Promise<void> {
    setSelectedOptions(event.detail.selectedOptions);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const actions = [
      ...event.detail.selectedOptions.map((option: MultiselectProps.Option) => option.value),
    ] as CaseAction[];
    await onUpdateMember({ ...caseMember, actions });
  }

  async function removeCaseMemberHandler() {
    try {
      setIsRemoving(true);
      await onRemoveMember(caseMember);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Grid gridDefinition={[{ colspan: { default: 12, xs: 10 } }, { colspan: { default: 12, xs: 2 } }]}>
      <ColumnLayout columns={2}>
        <FormField label={`${caseMember.userFirstName} ${caseMember.userLastName}`}>
          <TextContent>
            <u>{manageCaseAccessLabels.manageMemberEmailLabel}</u>
          </TextContent>
        </FormField>
        <FormField label={manageCaseAccessLabels.manageMemberPermissionsLabel}>
          <Multiselect
            selectedOptions={selectedOptions}
            onChange={onPermissionsChangeHandler}
            deselectAriaLabel={(e) => `Remove ${e.label}`}
            options={caseActionOptions.selectableOptions()}
            placeholder={manageCaseAccessLabels.manageMemberPermissionsPlaceholder}
            tokenLimit={1}
            disabled={isRemoving}
          />
        </FormField>
      </ColumnLayout>
      <div className={styles['button-container']}>
        <Button onClick={removeCaseMemberHandler} disabled={isRemoving}>
          {commonLabels.removeButton}
        </Button>
      </div>
    </Grid>
  );
}

export default ManageAccessListItem;
