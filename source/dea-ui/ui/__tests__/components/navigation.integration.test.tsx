import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Axios from 'axios';
import { navigationLabels } from '../../src/common/labels';
import BaseLayout from '../../src/components/BaseLayout';

afterEach(cleanup);

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const useRouter = jest.spyOn(require('next/router'), 'useRouter');
const router = {
  push: jest.fn(),
};
useRouter.mockReturnValue(router);

global.fetch = jest.fn(() => Promise.resolve({ blob: () => Promise.resolve('foo') }));
global.window.URL.createObjectURL = jest.fn(() => {});
HTMLAnchorElement.prototype.click = jest.fn();

let csvCall = -1;
let failingCall = -1;

const csvResult = [{ status: 'Running' }, { status: 'Running' }, 'csvresults'];
const failingCsvResult = [{ status: 'Running' }, { status: 'Running' }, { status: 'Cancelled' }];

describe('Navigation', () => {
  it('downloads system audit logs', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith('audit')) {
        return Promise.resolve({
          data: { auditId: 'audit-id' },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith('csv')) {
        return Promise.resolve({
          data: csvResult[++csvCall],
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        //availableEndpoints
        return Promise.resolve({
          data: {
            endpoints: ['/system/auditPOST'],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const baseLayout = render(<BaseLayout children={undefined} breadcrumbs={[]} />);
    expect(baseLayout).toBeTruthy();

    const downloadSystemLogsLink = await screen.findByText(navigationLabels.systemAuditLogsLabel);
    fireEvent.click(downloadSystemLogsLink);

    // assert spinner component
    const sideNavigation = wrapper(baseLayout.container).findSideNavigation()!;
    expect(sideNavigation).toBeTruthy();
    await waitFor(() => expect(wrapper(sideNavigation.getElement()).findSpinner()).toBeTruthy());
    await waitFor(() => expect(wrapper(sideNavigation.getElement()).findSpinner()).toBeFalsy(), {
      timeout: 4000,
    });
  });

  it('recovers from a from a csv download failure', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith('audit')) {
        return Promise.resolve({
          data: { auditId: 'audit-id' },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith('csv')) {
        return Promise.resolve({
          data: failingCsvResult[++failingCall],
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        //availableEndpoints
        return Promise.resolve({
          data: {
            endpoints: ['/system/auditPOST'],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const baseLayout = render(<BaseLayout children={undefined} breadcrumbs={[]} />);
    expect(baseLayout).toBeTruthy();

    const downloadSystemLogsLink = await screen.findByText(navigationLabels.systemAuditLogsLabel);
    fireEvent.click(downloadSystemLogsLink);

    // assert spinner component
    const sideNavigation = wrapper(baseLayout.container).findSideNavigation()!;
    expect(sideNavigation).toBeTruthy();
    await waitFor(() => expect(wrapper(sideNavigation.getElement()).findSpinner()).toBeTruthy());
    await waitFor(() => expect(wrapper(sideNavigation.getElement()).findSpinner()).toBeFalsy(), {
      timeout: 4000,
    });
    // error notification is visible
    const notificationsWrapper = wrapper(baseLayout.container).findFlashbar()!;
    expect(notificationsWrapper).toBeTruthy();
  });
});
