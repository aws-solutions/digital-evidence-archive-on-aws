import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fail } from 'assert';
import axios from 'axios';
import { breadcrumbLabels, commonLabels } from '../../src/common/labels';
import DataSyncTasksPage from '../../src/pages/data-sync-tasks';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const push = jest.fn();
const someDataSynctTask = {
  taskArn: '/task-04162224cf5ee44ef',
  taskId: 'task-04162224cf5ee44ef',
  sourceLocationArn: '/loc-05a0e021c355b87aa',
  destinationLocationArn: '/loc-04ea3e6a5e3037caa',
  dataVaultUlid: '01HBVA6EXVZ4HNB05S781NB38D',
  status: 'AVAILABLE',
  created: '2023-10-05T01:08:50.890Z',
};

jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: {},
    push,
  })),
}));

describe('DataSyncTasks Dashboard', () => {
  beforeAll(() => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith('availableEndpoints')) {
        return Promise.resolve({
          data: {
            endpoints: ['/datavaults/tasks/{taskId}/executionsPOST'],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.includes('/datavaults')) {
        return Promise.resolve({
          data: {
            dataVaults: [
              {
                ulid: '01HBVA6EXVZ4HNB05S781NB38D',
                name: 'Some Data Vault',
                description: 'Some description',
                created: '2023-09-29T01:00:51.916Z',
              },
            ],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.includes('/datasync/tasks')) {
        return Promise.resolve({
          data: {
            dataSyncTasks: [someDataSynctTask],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: {
            executionId: 'exec-0079f15d9d3ac1e3c',
            taskId: 'task-04162224cf5ee44ef',
            created: '2023-10-05T01:08:50.890Z',
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });
  });

  it('renders a list of data sync tasks', async () => {
    const page = render(<DataSyncTasksPage />);

    const listItem = await screen.findByText(someDataSynctTask.taskId);

    expect(page).toBeTruthy();
    expect(listItem).toBeTruthy();

    // assert breadcrumb
    const breadcrumbWrapper = wrapper(page.container).findBreadcrumbGroup();
    expect(breadcrumbWrapper).toBeTruthy();
    const breadcrumbLinks = breadcrumbWrapper?.findBreadcrumbLinks()!;
    expect(breadcrumbLinks.length).toEqual(1);
    expect(breadcrumbLinks[0].getElement()).toHaveTextContent(breadcrumbLabels.dataSyncTasks);
  });

  it('navigates to data vault details', async () => {
    render(<DataSyncTasksPage />);

    const table = await screen.findByTestId('data-sync-tasks-table');
    const link = wrapper(table).findLink(`[data-test-id="${someDataSynctTask.taskId}"]`);

    if (!link) {
      fail();
    }
    link.click();

    expect(push).toHaveBeenCalledWith(`/data-vault-detail?dataVaultId=${someDataSynctTask.dataVaultUlid}`);
  });

  it('can run a task', async () => {
    const page = render(<DataSyncTasksPage />);
    const pageWrapper = wrapper(page.baseElement);
    expect(page).toBeTruthy();
    expect(pageWrapper).toBeTruthy();

    const tableWrapper = pageWrapper.findTable();
    if (!tableWrapper) fail();
    expect(tableWrapper.findRows().length).toEqual(1);

    const runTaskButton = screen.queryByTestId('data-sync-run-task-button');
    if (!runTaskButton) fail();
    expect(runTaskButton).toBeDisabled();

    const taskSelection = tableWrapper.findRowSelectionArea(1);
    expect(taskSelection).toBeTruthy();
    await act(async () => {
      taskSelection!.click();
    });

    expect(tableWrapper.findSelectedRows().length).toEqual(1);

    await waitFor(() => expect(screen.queryByTestId('data-sync-run-task-button')).toBeEnabled());
    fireEvent.click(runTaskButton);

    await waitFor(() => expect(screen.queryByTestId('run-task-modal')).toBeVisible());
    const runTaskButtonInModal = screen.queryByTestId('submit-run-task');

    const copyButton = await screen.findByTestId('copy-datasync-link-button');
    expect(copyButton).toBeTruthy();

    const copyText = await screen.findByText(commonLabels.copyLinkLabel);
    expect(copyText).toBeTruthy();

    if (!runTaskButtonInModal) fail();
    fireEvent.click(runTaskButtonInModal);

    await waitFor(() => expect(screen.queryByTestId('data-sync-run-task-button')).toBeDisabled());
  });
});
