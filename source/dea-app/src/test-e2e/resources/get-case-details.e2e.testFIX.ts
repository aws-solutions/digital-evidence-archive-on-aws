/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

// import Joi from 'joi';
// import fetch from 'node-fetch';
// import { DeaCase } from '../../models/case';
// import { caseSchema } from '../../models/validation/case';
// import { deleteCase } from './test-helpers';

describe('get cases api', () => {
  it('EMPTY TEST CASE PLACEHOLDER', async () => {
    /* do nothing */
  });
  //   let deaApiUrl: string | undefined;
  //   beforeAll(() => {
  //     deaApiUrl = process.env.DEA_API_URL;
  //   });

  //   it('should get a created case', async () => {
  //     const caseName = 'caseWithDetails';
  //     const url = `${deaApiUrl}cases`;
  //     const response = await fetch(url, {
  //       method: 'POST',
  //       headers: {
  //         authorization: 'allow',
  //       },
  //       body: JSON.stringify({
  //         name: caseName,
  //         status: 'ACTIVE',
  //         description: 'some case description',
  //       }),
  //     });

  //     expect(response.ok).toBeTruthy();
  //     // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //     const createdCase = (await response.json()) as DeaCase;
  //     Joi.assert(createdCase, caseSchema);

  //     expect(createdCase.name).toEqual(caseName);

  //     const getResponse = await fetch(`${url}/${createdCase.ulid}`, {
  //       method: 'GET',
  //       headers: {
  //         authorization: 'allow',
  //       },
  //     });

  //     expect(getResponse.ok).toBeTruthy();
  //     // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //     const fetchedCase = (await getResponse.json()) as DeaCase;
  //     Joi.assert(fetchedCase, caseSchema);

  //     expect(fetchedCase).toEqual(createdCase);

  //     //await deleteCase(deaApiUrl ?? fail(), fetchedCase.ulid ?? fail());
  //   }, 10000);

  //   it('should throw an error when the case is not found', async () => {
  //     const url = `${deaApiUrl}cases`;
  //     const caseId = '123bogus';
  //     const getResponse = await fetch(`${url}/${caseId}`, {
  //       method: 'GET',
  //       headers: {
  //         authorization: 'allow',
  //       },
  //     });

  //     expect(getResponse.ok).toBeFalsy();
  //     expect(getResponse.status).toEqual(404);
  //     expect(await getResponse.text()).toEqual(`Case with ulid ${caseId} not found.`);
  //   });
});
