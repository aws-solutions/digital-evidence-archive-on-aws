import { render } from '@testing-library/react';
import { NotificationsProvider } from '../../src/context/NotificationsContext';

describe('notifications provider', () => {
  it('should render the notifications provider', () => {
    render(<NotificationsProvider children={false} />);
  });
});
