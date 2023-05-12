import { OWNER_ACTIONS } from '@aws/dea-app/lib/models/case-action';
import { caseActionOptions } from '../../src/common/labels';

describe('labels', () => {
  it('case action mappings', () => {
    const selectableOptions = caseActionOptions.selectableOptions();
    expect(OWNER_ACTIONS).toEqual(selectableOptions.map((option) => option.value));
  });
});
