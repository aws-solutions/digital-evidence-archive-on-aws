/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Model, Paged } from 'dynamodb-onetable';
import { deepEqual, instance, mock, verify, when } from 'ts-mockito';
import { DeaCase } from '../../models/case';
import { CaseStatus } from '../../models/case-status';
import { createCase, getCase, listCases, updateCase } from '../../persistence/case';
import { CaseType } from '../../persistence/schema/entities';

describe('case persistence', () => {
  it('should get a case by id', async () => {
    const ulid = '123abc';
    const mockModel: Model<CaseType> = mock();
    const getResponse: CaseType = {
      PK: 'CASE#123abc#',
      SK: 'CASE#',
      ulid: '123abc',
      name: 'The case of Charles Dexter Ward',
      lowerCaseName: 'the case of charles dexter ward',
      status: 'ACTIVE',
      objectCount: 0,
      description: 'a description',
    };

    when(
      mockModel.get(
        deepEqual({
          PK: `CASE#${ulid}#`,
          SK: `CASE#`,
        })
      )
    ).thenResolve(getResponse);

    const expectedCase: DeaCase = {
      ulid: '123abc',
      name: 'The case of Charles Dexter Ward',
      status: CaseStatus.ACTIVE,
      description: 'a description',
      objectCount: 0,
    };

    const deaCase = await getCase('123abc', { CaseModel: instance(mockModel) });

    verify(
      mockModel.get(
        deepEqual({
          PK: `CASE#${ulid}#`,
          SK: `CASE#`,
        })
      )
    ).once();

    expect(deaCase).toEqual(expectedCase);
  });

  it('should return undefined if a case is not found', async () => {
    const ulid = '123abc';
    const mockModel: Model<CaseType> = mock();

    when(
      mockModel.get(
        deepEqual({
          PK: `CASE#${ulid}#`,
          SK: `CASE#`,
        })
      )
    ).thenResolve(undefined);

    const deaCase = await getCase('123abc', { CaseModel: instance(mockModel) });

    verify(
      mockModel.get(
        deepEqual({
          PK: `CASE#${ulid}#`,
          SK: `CASE#`,
        })
      )
    ).once();

    expect(deaCase).toBeUndefined();
  });

  it('should list the first page of cases', async () => {
    const mockModel: Model<CaseType> = mock();
    const findResponse: Paged<CaseType> = [
      {
        PK: 'CASE#123abc#',
        SK: 'CASE#',
        ulid: '123abc',
        name: 'The case of Charles Dexter Ward',
        lowerCaseName: 'the case of charles dexter ward',
        status: 'ACTIVE',
        objectCount: 0,
        description: 'spooky',
      },
      {
        PK: 'CASE#xyz567#',
        SK: 'CASE#',
        ulid: 'xyz567',
        name: 'The Curious Case of Benjamin Button',
        lowerCaseName: 'the curious case of benjamin button',
        status: 'ACTIVE',
        objectCount: 0,
        description: 'geriatric baby',
      },
    ];
    findResponse.count = 2;
    findResponse.next = undefined;
    findResponse.prev = undefined;

    when(
      mockModel.find(
        deepEqual({
          GSI1PK: 'CASE#',
          GSI1SK: {
            begins_with: 'CASE#',
          },
        }),
        deepEqual({
          next: undefined,
          limit: 20,
          index: 'GSI1',
        })
      )
    ).thenResolve(findResponse);

    const expectedCases: Paged<DeaCase> = [
      {
        ulid: '123abc',
        name: 'The case of Charles Dexter Ward',
        status: CaseStatus.ACTIVE,
        description: 'spooky',
        objectCount: 0,
      },
      {
        ulid: 'xyz567',
        name: 'The Curious Case of Benjamin Button',
        status: CaseStatus.ACTIVE,
        objectCount: 0,
        description: 'geriatric baby',
      },
    ];
    expectedCases.count = 2;
    expectedCases.next = undefined;
    expectedCases.prev = undefined;

    const actual = await listCases(20, undefined, { CaseModel: instance(mockModel) });

    verify(
      mockModel.find(
        deepEqual({
          GSI1PK: 'CASE#',
          GSI1SK: {
            begins_with: 'CASE#',
          },
        }),
        deepEqual({
          next: undefined,
          limit: 20,
          index: 'GSI1',
        })
      )
    ).once();

    expect(actual).toEqual(expectedCases);
  });

  it('should create a case', async () => {
    const mockModel: Model<CaseType> = mock();

    const deaCase: DeaCase = {
      ulid: '8888',
      name: 'a case',
      status: CaseStatus.ACTIVE,
      description: 'a case description',
    };

    const responseEntity: CaseType = {
      PK: 'CASE#8888#',
      SK: 'CASE#',
      ulid: '8888',
      name: 'a case',
      lowerCaseName: 'a case',
      status: 'ACTIVE',
      objectCount: 0,
      description: 'a case description',
    };

    when(
      mockModel.create(
        deepEqual({
          ...deaCase,
          lowerCaseName: deaCase.name.toLowerCase(),
        })
      )
    ).thenResolve(responseEntity);

    const actual = await createCase(deaCase, { CaseModel: instance(mockModel) });

    verify(
      mockModel.create(
        deepEqual({
          ...deaCase,
          lowerCaseName: deaCase.name.toLowerCase(),
        })
      )
    ).once();

    expect(actual).toEqual({ ...deaCase, objectCount: 0 });
  });

  it('should update a case', async () => {
    const mockModel: Model<CaseType> = mock();

    const deaCase: DeaCase = {
      ulid: '8888',
      name: 'a case',
      status: CaseStatus.ACTIVE,
      description: 'a case description',
    };

    const responseEntity: CaseType = {
      PK: 'CASE#8888#',
      SK: 'CASE#',
      ulid: '8888',
      name: 'a case',
      lowerCaseName: 'a case',
      status: 'ACTIVE',
      objectCount: 0,
      description: 'a case description',
    };

    when(
      mockModel.update(
        deepEqual({
          ...deaCase,
          lowerCaseName: deaCase.name.toLowerCase(),
        })
      )
    ).thenResolve(responseEntity);

    const actual = await updateCase(deaCase, { CaseModel: instance(mockModel) });

    verify(
      mockModel.update(
        deepEqual({
          ...deaCase,
          lowerCaseName: deaCase.name.toLowerCase(),
        })
      )
    ).once();

    expect(actual).toEqual({ ...deaCase, objectCount: 0 });
  });
});
