import { render } from '@testing-library/react';
import { Notifications } from '../../../src/components/common-components/Notifications';
import { IAppNotification } from '../../../src/models/AppNotification';
import { useNotifications } from '../../../src/context/NotificationsContext';

const error: IAppNotification = {
  type: 'error',
  id: '1',
  content: 'This is an error',
};

const success: IAppNotification = {
  type: 'success',
  id: '2',
  content: 'This is a success',
};

jest.mock('../../../src/context/NotificationsContext');

const mockUseNotifications = jest.mocked(useNotifications);

describe('notifications', () => {
  it('should render', async () => {
    mockUseNotifications.mockImplementation(() => {
      return {
        notifications: [error, success],
        pushNotification() {},
        dismissNotification: () => {},
      };
    });
    const noti = render(<Notifications />);
    expect(noti).toBeTruthy();
  });
});
