/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from 'assert';
import { ValidationError } from '../../../app/exceptions/validation-exception';
import { getCaseActions } from '../../../app/resources/get-case-actions';
import { CaseAction } from '../../../models/case-action';
import { CaseUser } from '../../../models/case-user';
import { DeaUser } from '../../../models/user';
import { createCase } from '../../../persistence/case';
import { createCaseUser } from '../../../persistence/case-user';
import { ModelRepositoryProvider } from '../../../persistence/schema/entities';
import { createUser } from '../../../persistence/user';
import { dummyContext, getDummyEvent } from '../../integration-objects';
import { getTestRepositoryProvider } from '../../persistence/local-db-table';

let repositoryProvider: ModelRepositoryProvider;
let caseOwner: DeaUser;

describe('getCaseActions', () => {
  beforeAll(async () => {
    repositoryProvider = await getTestRepositoryProvider('getCaseActionsTest');

    caseOwner =
      (await createUser(
        {
          tokenId: 'caseowner',
          idPoolId: 'caseowneridentityid',
          firstName: 'Case',
          lastName: 'Owner',
        },
        repositoryProvider
      )) ?? fail();
  });

  afterAll(async () => {
    await repositoryProvider.table.deleteTable('DeleteTableForever');
  });

  it('should only return the membership on the requested case', async () => {
    // GIVEN a user with membership to case 1 and 2
    //create cases
    const case1 =
      (await createCase(
        {
          name: 'getCaseActions-1',
        },
        caseOwner,
        repositoryProvider
      )) ?? fail();

    const case2 =
      (await createCase(
        {
          name: 'getCaseActions-2',
        },
        caseOwner,
        repositoryProvider
      )) ?? fail();

    // create user
    const user =
      (await createUser(
        {
          tokenId: 'jacksonwang',
          idPoolId: 'jacksonwangidentityid',
          firstName: 'Jackson',
          lastName: 'Wang',
        },
        repositoryProvider
      )) ?? fail();

    // create user-case memberships
    const case1Actions = [CaseAction.VIEW_CASE_DETAILS];
    await createCaseUser(
      {
        caseUlid: case1.ulid ?? 'bogus',
        userUlid: user.ulid ?? 'bogus',
        actions: case1Actions,
        caseName: case1.name,
        userFirstName: user.firstName,
        userLastName: user.lastName,
      },
      repositoryProvider
    );

    const case2Actions = [CaseAction.VIEW_FILES];
    await createCaseUser(
      {
        caseUlid: case2.ulid ?? 'bogus',
        userUlid: user.ulid ?? 'bogus',
        actions: case2Actions,
        caseName: case2.name,
        userFirstName: user.firstName,
        userLastName: user.lastName,
      },
      repositoryProvider
    );

    // WHEN requesting the user's cases
    // test sut
    const event = getDummyEvent({
      pathParameters: {
        caseId: case1.ulid,
      },
    });
    // simulate runLambdaPreChecks by adding the userUlid to the event
    // the integration between runLambdaPrechecks and this lambda handler
    // will be tested in the e2e tests
    event.headers['userUlid'] = user.ulid;
    const response = await getCaseActions(event, dummyContext, repositoryProvider);

    // THEN only actions for case 1 are returned
    // confirm memberships only returned
    if (!response.body) {
      fail();
    }

    const caseUser: CaseUser = JSON.parse(response.body);
    expect(caseUser.caseUlid === case1.ulid).toBeTruthy();
    expect(caseUser.userUlid === user.ulid).toBeTruthy();
    expect(caseUser.actions.join('|') === case1Actions.join('|')).toBeTruthy();
    expect(caseUser.actions.join('|') === case2Actions.join('|')).toBeFalsy();
  });

  it('should fail when the userUlid is not present in the event', async () => {
    // runLambdaPreChecks inserts the userUlid into the event header so dea lambda
    // execution will not have to reverify and decode the cognito token and
    // grab the user from the database.
    // Therefore, if the event does not contain the ulid, getCaseActions should fail
    // GIVEN a user with membership to case 1
    //create cases
    const case1 =
      (await createCase(
        {
          name: 'getCaseActions-1c',
        },
        caseOwner,
        repositoryProvider
      )) ?? fail();

    // create user
    const user =
      (await createUser(
        {
          tokenId: 'michaeljack',
          idPoolId: 'michaeljackidentityid',
          firstName: 'Michael',
          lastName: 'Jack',
        },
        repositoryProvider
      )) ?? fail();

    // create user-case memberships
    await createCaseUser(
      {
        caseUlid: case1.ulid ?? 'bogus',
        userUlid: user.ulid ?? 'bogus',
        actions: [CaseAction.VIEW_CASE_DETAILS],
        caseName: case1.name,
        userFirstName: user.firstName,
        userLastName: user.lastName,
      },
      repositoryProvider
    );

    // WHEN requesting the user's cases
    // test sut
    const event = getDummyEvent({
      pathParameters: {
        caseId: case1.ulid,
      },
    });

    await expect(getCaseActions(event, dummyContext, repositoryProvider)).rejects.toThrowError(
      'userUlid was not present in the event header'
    );
  });

  it('should throw an error if the path param is missing', async () => {
    await expect(getCaseActions(getDummyEvent(), dummyContext, repositoryProvider)).rejects.toThrow(
      ValidationError
    );
  });
});
