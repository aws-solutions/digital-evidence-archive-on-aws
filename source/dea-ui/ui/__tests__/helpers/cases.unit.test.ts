import axios from 'axios';
import useSWR from 'swr';
import {
  createCase,
  useGetCaseById,
  useListAllCases,
  useListCaseFiles,
  useListMyCases,
} from '../../src/api/cases';
import { CreateCaseForm } from '../../src/models/Cases';

jest.mock('swr');
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useListAllCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a list of all cases', () => {
    const mockCases = {
      cases: [
        { id: 12345, name: 'Who killed Anakin' },
        { id: 23456, name: 'How is Palpatine Alive' },
        { id: 123213, name: 'Is Mace Windu Alive' },
        { id: 123123, name: 'Baby yoda or grogu?' },
      ],
    };
    useSWR.mockReturnValue({ data: mockCases, isValidating: false });

    const { data, isLoading } = useListAllCases();
    expect(data).toEqual(mockCases.cases);
    expect(isLoading).toEqual(false);
  });

  it('should return a list of my cases', () => {
    const mockCases = {
      cases: [
        { id: 12345, name: 'Who killed Anakin' },
        { id: 23456, name: 'How is Palpatine Alive' },
      ],
    };
    useSWR.mockReturnValue({ data: mockCases, isValidating: false });

    const { data, isLoading } = useListMyCases();
    expect(data).toEqual(mockCases.cases);
    expect(isLoading).toEqual(false);
  });

  it('should return a single case', () => {
    const mockCase = {
      id: 12345,
      name: 'Who killed Anakin',
    };
    useSWR.mockReturnValue({ data: mockCase, isValidating: false });

    const { data, isLoading } = useGetCaseById('12345');
    expect(data).toEqual(mockCase);
    expect(isLoading).toEqual(false);
  });

  it('should create case', async () => {
    mockedAxios.create.mockReturnThis();
    mockedAxios.request.mockResolvedValue({
      data: { id: 12345, name: 'Who killed Anakin' },
      status: 200,
      statusText: 'Ok',
      headers: {},
      config: {},
    });

    const dummyForm: CreateCaseForm = {
      name: 'testcaseform',
      description: 'abcde',
    };
    await expect(createCase(dummyForm)).toBeTruthy();
  });

  it('should return a list of my files', () => {
    const mockFiles = [
      {
        files: [
          { id: 1, name: 'Case One' },
          { id: 2, name: 'Case Two' },
        ],
        next: 'page2',
      },
      {
        files: [
          { id: 3, name: 'Case Three' },
          { id: 4, name: 'Case Four' },
        ],
      },
    ];
    useSWR.mockReturnValue({ data: mockFiles, isValidating: false });

    const { data, isLoading } = useListCaseFiles('dummyId', '/');
    expect(data.length).toEqual(4);
    expect(isLoading).toEqual(false);
  });
});
