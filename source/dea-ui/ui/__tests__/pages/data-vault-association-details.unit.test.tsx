import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DataVaultAssociationDetailsBody from '../../src/components/file-details/DataVaultAssociationDetailsBody';

describe('DataVault association details body', () => {
  const dataVaultTestName = 'Test data vault name';

  it('renders a data vault details section', async () => {
    const props = {
      dataVaultUlid: 'dummyulid',
      dataVaultName: dataVaultTestName,
      executionId: 'dummyexecutionid',
      associationCreatedBy: 'Some name',
      associationDate: new Date(),
    };

    render(<DataVaultAssociationDetailsBody {...props} />);

    await screen.findByText(dataVaultTestName);
  });
});
