import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fail } from 'assert';
import Axios from 'axios';
import { commonLabels } from '../../src/common/labels';
import CaseDetailsPage from '../../src/pages/case-detail';

const CASE_ID = '100';
interface Query {
  caseId: string | object;
}
let query: Query = {
  caseId: CASE_ID,
};
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: jest.fn().mockImplementation((key: keyof Query) => query[key]),
  }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

global.fetch = jest.fn(() => Promise.resolve({ blob: () => Promise.resolve('foo') }));
global.window.URL.createObjectURL = jest.fn(() => {});
HTMLAnchorElement.prototype.click = jest.fn();

jest.mock('axios');
const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const mockFilesRoot = {
  files: [
    {
      ulid: '01GV3NH93AX2GYHBQNVR27NEMJ',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      fileName: 'food',
      contentType: 'application/octet-stream',
      createdBy: '01GV13XRYZE1VKY7TY88Y7RPH0',
      filePath: '/',
      fileSizeMb: 50,
      uploadId:
        'aiV5S5CTX6FSWerMkYsVw9vXDp8Xes2gyEDQPPxI4b7LZjk8fKPOFrX7cn_bOupAE.xZ9M0d2HkB_075dVSYsAOKhixAN987_YXJbyUulyWgW8ORp93oRO1U0WMwhmxTE7o5gWoiJlHuVIZptds8Thgpac.4K9ChEeh2Sac35kNGH43XoSFadbzzcWCB9ZKFGP9P0gxfxRlSg4YdTyXIaw--',
      sha256Hash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      versionId: '8pXrPWVxZoRiCszVYB2lShmCoxWH9Fca',
      status: 'ACTIVE',
      created: '2023-03-09T17:08:40.682Z',
      updated: '2023-03-09T17:08:40.682Z',
      isFile: true,
      ttl: 1678385311,
    },
  ],
  total: 1,
};

const mockedCaseDetail = {
  ulid: CASE_ID,
  name: 'mocked case',
  status: 'ACTIVE',
};

const mockedCaseActions = {
  caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
  userUlid: '01GVHP0HP5V2A80XJZTHJH4QGD',
  userFirstName: 'John',
  userLastName: 'Doe',
  caseName: 'Investigation One',
  actions: [
    'VIEW_CASE_DETAILS',
    'UPDATE_CASE_DETAILS',
    'UPLOAD',
    'DOWNLOAD',
    'VIEW_FILES',
    'CASE_AUDIT',
    'INVITE',
    'RESTORE_FILES',
  ],
  created: '2023-03-23T15:38:26.955Z',
  updated: '2023-03-23T15:38:26.955Z',
};

describe('case detail file restore', () => {
  it('restores selected files', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockImplementation((eventObj) => {
      if (eventObj.url?.endsWith(`${CASE_ID}/details`)) {
        return Promise.resolve({
          data: mockedCaseDetail,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith(`${CASE_ID}/actions`)) {
        return Promise.resolve({
          data: mockedCaseActions,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith('contents')) {
        return Promise.resolve({
          data: { isArchived: true, isRestoring: false },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url?.endsWith('availableEndpoints')) {
        return Promise.resolve({
          data: {
            endpoints: ['/cases/{caseId}/files/{fileId}/restorePUT'],
          },
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else {
        return Promise.resolve({
          data: mockFilesRoot,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      }
    });

    const page = render(<CaseDetailsPage />);

    expect(page).toBeTruthy();

    const table = await screen.findByTestId('file-table');
    const tableWrapper = wrapper(table);
    expect(table).toBeTruthy();

    // check that restore modal is invisible
    const restoreModal = screen.queryByTestId('restore-modal');
    if (!restoreModal) {
      fail();
    }

    expect(restoreModal.className).toMatch('awsui_hidden_');

    const fileSelector = tableWrapper.findCheckbox();
    if (!fileSelector) {
      fail();
    }

    await act(async () => {
      fileSelector.click();
    });

    /**
     * Click the download button, then a modal with a second download button and input field should appear
     * User enters some download reason, then click download, and the modal should close
     */
    await waitFor(() => expect(screen.queryByTestId('download-file-button')).toBeEnabled());
    await waitFor(() =>
      expect(
        wrapper(document.body).findModal('[data-testid="download-file-reason-modal"]')?.isVisible()
      ).toBe(false)
    );
    await wrapper(screen.getByTestId('download-file-button')).click();

    await waitFor(() =>
      expect(
        wrapper(document.body).findModal('[data-testid="download-file-reason-modal"]')?.isVisible()
      ).toBe(true)
    );
    const wrappedReason = wrapper(document.body).findInput(
      '[data-testid="download-file-reason-modal-input"]'
    );
    if (!wrappedReason) {
      fail();
    }
    wrappedReason.setInputValue('Reason for download,;,.');

    wrapper(screen.getByTestId('download-file-reason-modal-primary-button')).click();
    await waitFor(() =>
      expect(
        wrapper(document.body).findModal('[data-testid="download-file-reason-modal"]')?.isVisible()
      ).toBe(false)
    );

    // restore modal will become visible when user tries to download archived file
    await waitFor(() =>
      expect(screen.queryByTestId('restore-modal')?.className).not.toMatch('awsui_hidden_')
    );
    const restoreButton = await screen.findByText(commonLabels.restoreButton);
    if (!restoreButton) {
      fail();
    }

    fireEvent.click(restoreButton);
    // check that modal is hidden after restore initiated
    await waitFor(() => expect(screen.queryByTestId('restore-modal')?.className).toMatch('awsui_hidden_'));
  });
});
