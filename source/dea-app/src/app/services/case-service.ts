import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { createCase, updateCase } from '../../persistence/case';

export const createCases = async (deaCase: DeaCase): Promise<DeaCase | undefined> => {
  const currentCase: DeaCase = {
    name: deaCase.name,
    status: CaseStatus.ACTIVE,
    description: deaCase.description,
    objectCount: 0,
  };

  // TODO: create initial User/Owner on CreateCase

  return await createCase(currentCase);
};

export const updateCases = async (deaCase: DeaCase, caseId: string): Promise<DeaCase | undefined> => {
  const currentCase: DeaCase = {
    ulid: caseId,
    name: deaCase.name,
    status: deaCase.status,
    description: deaCase.description,
  };

  return await updateCase(currentCase);
};
