import { render, screen } from '@testing-library/react';
import { Button } from '@cloudscape-design/components';
import ActionContainer from '../../../src/components/common-components/ActionContainer';

describe('action container', () => {
  it('should render the inner component', async () => {
    render(
      <ActionContainer required="Create" actions={['Create']}>
        <Button>Create</Button>
      </ActionContainer>
    );
    const createButton = await screen.getByRole('button');
    expect(createButton).toBeTruthy();
  });

  it('should not render the inner component', async () => {
    render(
      <ActionContainer required="Create" actions={['View']}>
        <Button>Create</Button>
      </ActionContainer>
    );
    const createButton = screen.queryByRole('button');
    expect(createButton).toBeFalsy();
  });
});
