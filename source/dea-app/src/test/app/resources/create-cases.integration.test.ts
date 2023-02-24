/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { APIGatewayProxyResult } from 'aws-lambda';
import Joi from 'joi';
import { createCases } from '../../../app/resources/create-cases';
import { getCaseUsersForUser } from '../../../app/services/case-user-service';
import { DeaCase } from '../../../models/case';
import { OWNER_ACTIONS } from '../../../models/case-action';
import { DeaUser } from '../../../models/user';
import { caseResponseSchema } from '../../../models/validation/case';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, dummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let user: DeaUser;

describe('create cases resource', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('createCasesTest');

    // create user
    user =
      (await createUser(
        {
          tokenId: 'jackwang',
          firstName: 'Jack',
          lastName: 'Wang',
        },
        repositoryProvider
      )) ?? fail();
  });

  afterEach(async () => {
    delete dummyEvent.headers['userUlid'];
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should successfully create a case', async () => {
    const caseName = 'ANewCase';
    const caseUlid = await createAndValidateCase(caseName, 'A description of the new case', user.ulid);

    //check the user has been added as a case user with all permissions
    const casesForUser = await getCaseUsersForUser(
      user.ulid ?? '',
      /*limit=*/ undefined,
      /*next*/ undefined,
      repositoryProvider
    );

    expect(casesForUser.length).toEqual(1);
    const caseUser = casesForUser[0];
    expect(caseUser.caseUlid).toStrictEqual(caseUlid);
    expect(caseUser.caseName).toStrictEqual(caseName);
    expect(caseUser.actions).toEqual(OWNER_ACTIONS);
  });

  it('should fail when the userUlid is not present in the event', async () => {
    // runLambdaPreChecks inserts the userUlid into the event header so dea lambda
    // execution will not have to reverify and decode the cognito token and
    // grab the user from the database.
    // Therefore, if the event does not contain the ulid, CreateCase should fail
    try {
      await createAndValidateCase('ANewCaseFail', 'A description of the new case');
      fail(); // should not reach this statement
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      expect((error as Error).message).toStrictEqual('userUlid was not present in the event header');
    }
  });

  it('should fail when the caller is not in the DB', async () => {
    // runLambdaPreChecks adds all first time federated users to the db
    // before any exection code is run. So if the caller is not
    // added to the db before the create-case code is run, it is
    // a server error and CreateCase should fail
    try {
      // Pass in fake ulid
      await createAndValidateCase(
        'ANewCaseFail',
        'A description of the new case',
        '01ARZ3NDEKTSV4RRFFQ69G5FAV'
      );
      fail(); // should not reach this statement
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      expect((error as Error).message).toStrictEqual('Could not find case creator as a user in the DB');
    }
  });

  it('should fail to create a case when the provided name is already in use', async () => {
    const name = 'Case-Test2';
    const description = 'A description of the new case';
    const status = 'ACTIVE';
    await createAndValidateCase(name, description, user.ulid);

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        body: JSON.stringify({
          name,
          status,
          description,
        }),
      }
    );
    event.headers['userUlid'] = user.ulid;
    await expect(createCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Transaction Cancelled'
    );
  });

  it('should throw a validation exception when no name is provided', async () => {
    const status = 'ACTIVE';
    const description = 'monday tuesday wednesday';

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        body: JSON.stringify({
          status,
          description,
        }),
      }
    );
    event.headers['userUlid'] = user.ulid;
    await expect(createCases(event, dummyContext, repositoryProvider)).rejects.toThrow(`"name" is required`);
  });

  it('should throw a validation exception when no payload is provided', async () => {
    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        body: null,
      }
    );
    event.headers['userUlid'] = user.ulid;
    await expect(createCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      'Create cases payload missing.'
    );
  });

  it('should enforce a strict payload', async () => {
    const status = 'ACTIVE';
    const name = 'ACaseWithGeneratedUlid';
    const description = 'should ignore provided ulid';
    const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        body: JSON.stringify({
          name,
          status,
          description,
          ulid,
        }),
      }
    );
    event.headers['userUlid'] = user.ulid;
    await expect(createCases(event, dummyContext, repositoryProvider)).rejects.toThrow(
      `"ulid" is not allowed`
    );
  });

  it('should create ACTIVE case when no status given', async () => {
    const name = 'ACaseWithNoStatus';
    const description = 'should create in active status';

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        body: JSON.stringify({
          name,
          description,
        }),
      }
    );
    event.headers['userUlid'] = user.ulid;
    const response = await createCases(event, dummyContext, repositoryProvider);
    await validateAndReturnCase(name, description, 'ACTIVE', response);
  });

  it('should create INACTIVE case when requested', async () => {
    const name = 'InactiveCase';
    const description = 'should create in inactive status';
    const status = 'INACTIVE';

    const event = Object.assign(
      {},
      {
        ...dummyEvent,
        body: JSON.stringify({
          name,
          description,
          status,
        }),
      }
    );
    event.headers['userUlid'] = user.ulid;
    const response = await createCases(event, dummyContext, repositoryProvider);
    await validateAndReturnCase(name, description, status, response);
  });
});

async function createAndValidateCase(name: string, description: string, userUlid?: string): Promise<string> {
  const status = 'ACTIVE';

  const event = Object.assign(
    {},
    {
      ...dummyEvent,
      body: JSON.stringify({
        name,
        status,
        description,
      }),
    }
  );
  event.headers['userUlid'] = userUlid;
  const response = await createCases(event, dummyContext, repositoryProvider);
  const newCase = await validateAndReturnCase(name, description, status, response);
  return newCase.ulid ?? fail();
}

async function validateAndReturnCase(
  name: string,
  description: string,
  status: string,
  response: APIGatewayProxyResult
): Promise<DeaCase> {
  expect(response.statusCode).toEqual(200);

  if (!response.body) {
    fail();
  }

  const newCase: DeaCase = JSON.parse(response.body);

  Joi.assert(newCase, caseResponseSchema);
  expect(newCase.name).toEqual(name);
  expect(newCase.status).toEqual(status);
  expect(newCase.description).toEqual(description);

  return newCase;
}
