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
  SpaceBetween,
} from '@cloudscape-design/components';
import { useMemo, useState } from 'react';
import {
  caseActionOptions,
  commonLabels,
  commonTableLabels,
  manageCaseAccessLabels,
} from '../../common/labels';
import styles from '../../styles/ManageAccessListItem.module.scss';
import { ConfirmModal } from '../common-components/ConfirmModal';

export interface ManageAccessListItemProps {
  readonly caseMember: CaseUser;
  readonly onRemoveMember: (user: CaseUser) => Promise<void>;
  readonly onUpdateMember: (user: CaseUser) => Promise<void>;
  readonly activeUser: CaseUser;
}

function ManageAccessListItem(props: ManageAccessListItemProps): JSX.Element {
  const { caseMember, onRemoveMember, onUpdateMember, activeUser } = props;
  const [selectedOptions, setSelectedOptions] = useState<ReadonlyArray<SelectProps.Option>>(
    caseMember.actions.map((action) => caseActionOptions.actionOption(action))
  );
  const [isOpenRemoveModal, setIsOpenRemoveModal] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  useMemo(() => {
    const entryBelongsToActiveUser = caseMember.userUlid === activeUser?.userUlid;
    setIsDisabled(isRemoving || entryBelongsToActiveUser);
  }, [caseMember, activeUser, isRemoving]);

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
    setIsOpenRemoveModal(false);
    try {
      setIsRemoving(true);
      await onRemoveMember(caseMember);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <FormField stretch={true}>
      <Grid
        key={caseMember.userUlid}
        gridDefinition={[{ colspan: { default: 12, xs: 10 } }, { colspan: { default: 12, xs: 2 } }]}
      >
        <ColumnLayout columns={2}>
          <FormField label={`${caseMember.userFirstName} ${caseMember.userLastName}`} />
          <FormField label={manageCaseAccessLabels.manageMemberPermissionsLabel}>
            <Multiselect
              data-testid={`${caseMember.userUlid}-multiselect`}
              selectedOptions={selectedOptions}
              onChange={onPermissionsChangeHandler}
              deselectAriaLabel={commonLabels.deselectLabel}
              options={caseActionOptions.selectableOptions()}
              placeholder={manageCaseAccessLabels.manageMemberPermissionsPlaceholder}
              tokenLimit={1}
              disabled={isDisabled}
              i18nStrings={{
                tokenLimitShowMore: commonTableLabels.limitShowMoreLabel,
                tokenLimitShowFewer: commonTableLabels.limitShowFewerLabel,
              }}
              selectedAriaLabel={commonLabels.selectedLabel}
            />
          </FormField>
        </ColumnLayout>
        <div className={styles['button-container']}>
          <ConfirmModal
            testid="access-confirm-modal"
            isOpen={isOpenRemoveModal}
            title={manageCaseAccessLabels.removeCaseMemberRequestTitle(
              `${caseMember.userFirstName} ${caseMember.userLastName}`
            )}
            message={manageCaseAccessLabels.removeCaseMemberRequestMessage}
            confirmButtonText={commonLabels.removeButton}
            confirmAction={removeCaseMemberHandler}
            cancelAction={() => setIsOpenRemoveModal(false)}
          />
          <Button
            ariaLabel={commonLabels.removeButton}
            data-testid={`${caseMember.userUlid}-remove-button`}
            onClick={() => setIsOpenRemoveModal(true)}
            disabled={isDisabled}
          >
            {commonLabels.removeButton}
          </Button>
        </div>
        <SpaceBetween size="xs"></SpaceBetween>
      </Grid>
    </FormField>
  );
}

export default ManageAccessListItem;
