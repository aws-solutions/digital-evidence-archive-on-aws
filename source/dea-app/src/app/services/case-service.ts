import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { createCase, updateCase } from '../../persistence/case';

export const createCases = async (deaCase: DeaCase): Promise<DeaCase | undefined> => {
  const currentCase: DeaCase = {
    ...deaCase,
    status: CaseStatus.ACTIVE,
    objectCount: 0,
  };

  // TODO: create initial User/Owner on CreateCase

  return await createCase(currentCase);
};

export const updateCases = async (deaCase: DeaCase): Promise<DeaCase | undefined> => {
  return await updateCase(deaCase);
};
