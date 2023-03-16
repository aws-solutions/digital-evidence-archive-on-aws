import wrapper from '@cloudscape-design/components/test-utils/dom';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { fail } from 'assert';
import axios from 'axios';
import { caseDetailLabels, commonLabels } from '../../src/common/labels';
import CaseDetailsPage from '../../src/pages/case-detail';

const push = jest.fn();
const CASE_ID = '100';
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockImplementation(() => ({
    query: { caseId: CASE_ID },
    push,
  })),
}));

jest.mock('axios');
const mockedAxios = axios as jest.MockedFunction<typeof axios>;

const mockFilesRoot = {
  cases: [
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
      isFile: false,
      ttl: 1678385311,
    },
    {
      ulid: '01GV4J7C6D18WQVCBA7RAPXTT1',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      fileName: 'rootFile',
      contentType: 'application/octet-stream',
      createdBy: '01GV13XRYZE1VKY7TY88Y7RPH0',
      filePath: '/',
      fileSizeMb: 50,
      uploadId:
        'OEQeZM6D6jYzdHm6nnpXggWDlDhSZbZ1mcUe7JKdpfHP5zSnWlQ3kU.iz5v6zyOiQVvPqS9BfFixgBQgxRaa242L6XQyT2MwzUw7Nizk1pvXQJR_anulhvuvjGH_hpQ1x7ciO5yEDWEKTaxBF5vtxSryncXAFpHfBWBzSQi01Eou9I8PzadqnirZU0PBlN.3DxFuJP8pG2FTMHlBQSlEcA--',
      sha256Hash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      versionId: 'mwXq6KDGPfw8qD3oUeDNjh2dsSGWWHad',
      status: 'ACTIVE',
      created: '2023-03-10T01:30:04.877Z',
      updated: '2023-03-10T01:30:14.326Z',
      isFile: true,
    },
  ],
  total: 2,
};

const mockFilesFood = {
  cases: [
    {
      ulid: '01GV3NH93AX2GYHBQNVR27NEMJ',
      caseUlid: '01GV15BH762P6MW1QH8EQDGBFQ',
      fileName: 'sushi.png',
      contentType: 'application/octet-stream',
      createdBy: '01GV13XRYZE1VKY7TY88Y7RPH0',
      filePath: '/food',
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
  ulid: 'abc',
  name: 'mocked case',
  status: 'ACTIVE',
};

describe('CaseDetailsPage', () => {
  it('renders a case details page', async () => {
    mockedAxios.mockImplementation((event) => {
      const eventObj: any = event;
      if (eventObj.url === 'https://localhostcases/100/') {
        return Promise.resolve({
          data: mockedCaseDetail,
          status: 200,
          statusText: 'Ok',
          headers: {},
          config: {},
        });
      } else if (eventObj.url === 'https://localhostcases/100/files?filePath=/food/') {
        return Promise.resolve({
          data: mockFilesFood,
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

    const mockedCaseInfo = await screen.findByText('mocked case');
    expect(mockedCaseInfo).toBeTruthy();

    const table = await screen.findByTestId('file-table');
    const tableWrapper = wrapper(table);
    // the table exists
    expect(table).toBeTruthy();

    const folderEntry = await screen.findByTestId('food-button');
    const fileEntry = await screen.findByTestId('rootFile-box');
    // the folder button exists
    expect(folderEntry).toBeTruthy();
    // the file exists as a box
    expect(fileEntry).toBeTruthy();

    // const textFilter = await screen.findByTestId('files-text-filter');
    const textFilter = tableWrapper.findTextFilter();
    if (!textFilter) {
      fail();
    }
    const textFilterInput = textFilter.findInput();
    textFilterInput.setInputValue('food');

    // after filtering, rootFile will not be visible
    await waitFor(() => expect(screen.queryByTestId('rootFile-box')).toBeNull());

    // click on the folder to navigate
    fireEvent.click(folderEntry);

    // clear the filter
    textFilterInput.setInputValue('');

    // we should now see the new file "sushi.png"
    await screen.findByTestId('sushi.png-box');
    const breadcrumb = tableWrapper.findBreadcrumbGroup();
    if (!breadcrumb) {
      fail();
    }
    const links = breadcrumb.findBreadcrumbLinks();
    expect(links.length).toEqual(2);

    // click the breadcrumb to return to the root
    const rootLink = await screen.findByText('/');
    fireEvent.click(rootLink);

    // should find the original rows again
    await screen.findByTestId('food-button');
    await screen.findByTestId('rootFile-box');
  });

  it('navigates to manage access page', async () => {
    mockedAxios.mockResolvedValue({
      data: {
        ulid: 'abc',
        name: 'mocked case',
        status: 'ACTIVE',
      },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const tab = await screen.findByText(caseDetailLabels.manageAccessLabel);
    fireEvent.click(tab);
    const accessInput = await screen.findByTestId('manage-access-input');
    expect(accessInput).toBeTruthy();
    expect(accessInput).toBeInTheDocument();
    expect(accessInput.nodeValue).toEqual(null);

    const container = await screen.findByTestId('manage-access-container');
    const input = wrapper(container).findFormField()?.findControl()?.findInput();

    if (!input) {
      fail();
    }

    const newVal = 'new input value';
    input.setInputValue(newVal);
  });

  it('navigates to upload files page', async () => {
    mockedAxios.mockResolvedValue({
      data: mockedCaseDetail,
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const page = render(<CaseDetailsPage />);
    expect(page).toBeTruthy();

    const uploadButton = await screen.findByText(commonLabels.uploadButton);
    fireEvent.click(uploadButton);
    expect(push).toHaveBeenCalledWith(`/upload-files?caseId=${CASE_ID}&filePath=/`);
  });
});
