/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { Oauth2Token } from '../../models/auth';
import { DeaCase } from '../../models/case';
import { CaseAction, OWNER_ACTIONS } from '../../models/case-action';
import { CaseStatus } from '../../models/case-status';
import { CaseUser } from '../../models/case-user';
import { CaseUserDTO } from '../../models/dtos/case-user-dto';
import { caseUserResponseSchema } from '../../models/validation/case-user';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  callDeaAPIWithCreds,
  createCaseSuccess,
  deleteCase,
  getSpecificUserByFirstName,
  randomSuffix,
} from './test-helpers';

describe('GetCaseActions E2E', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testOwner = `getCaseActions${suffix}-Owner`;
  const testInvitee = `getCaseActions${suffix}-Invitee`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let targetCase: DeaCase;
  let inviteeUlid: string;
  let ownerUlid: string;

  const caseIdsToDelete: string[] = [];

  let ownerCreds: Credentials;
  let inviteeCreds: Credentials;
  let ownerToken: Oauth2Token;
  let inviteeToken: Oauth2Token;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testOwner, 'CaseWorker', testOwner, 'TestUser');
    await cognitoHelper.createUser(testInvitee, 'CaseWorker', testInvitee, 'TestUser');

    [ownerCreds, ownerToken] = await cognitoHelper.getCredentialsForUser(testOwner);

    // initialize the invitee into the DB
    [inviteeCreds, inviteeToken] = await cognitoHelper.getCredentialsForUser(testInvitee);
    await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', inviteeToken, inviteeCreds);

    // get owner ulid
    ownerUlid = (await getSpecificUserByFirstName(deaApiUrl, testOwner, ownerToken, ownerCreds)).ulid!;

    // get invitee ulid
    inviteeUlid = (await getSpecificUserByFirstName(deaApiUrl, testInvitee, ownerToken, ownerCreds)).ulid!;

    const deaCase = {
      name: `The Quary${suffix}`,
      status: CaseStatus.ACTIVE,
    };
    targetCase = await createCaseSuccess(deaApiUrl, deaCase, ownerToken, ownerCreds);
    caseIdsToDelete.push(targetCase.ulid!);
  }, 30000);

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, ownerToken, ownerCreds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  it('GET', async () => {
    // confirm owner has OWNER_ACTIONS
    const ownerResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/actions`,
      'GET',
      ownerToken,
      ownerCreds
    );
    expect(ownerResponse.status).toEqual(200);
    const ownerUser: CaseUser = await ownerResponse.data;
    Joi.assert(ownerUser, caseUserResponseSchema);
    expect(ownerUser.caseUlid === targetCase.ulid).toBeTruthy();
    expect(ownerUser.userUlid === ownerUlid).toBeTruthy();
    expect(ownerUser.actions.join('|') === OWNER_ACTIONS.join('|')).toBeTruthy();

    // confirm invitee doesn't have access
    const noAccessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/actions`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(noAccessResponse.status).toEqual(404);

    // invite the user
    const inviteeActions = [CaseAction.VIEW_CASE_DETAILS];
    const newMembership: CaseUserDTO = {
      userUlid: inviteeUlid,
      caseUlid: targetCase.ulid!,
      actions: inviteeActions,
    };
    const inviteResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/user-memberships`,
      'POST',
      ownerToken,
      ownerCreds,
      newMembership
    );
    expect(inviteResponse.status).toEqual(200);

    // confirm invitee has view access
    const accessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/actions`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(accessResponse.status).toEqual(200);
    const caseUser: CaseUser = await accessResponse.data;
    Joi.assert(caseUser, caseUserResponseSchema);
    expect(caseUser.caseUlid === targetCase.ulid).toBeTruthy();
    expect(caseUser.userUlid === inviteeUlid).toBeTruthy();
    expect(caseUser.actions.join('|') === inviteeActions.join('|')).toBeTruthy();

    // Delete the membership
    const dismissResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/users/${inviteeUlid}/memberships`,
      'DELETE',
      ownerToken,
      ownerCreds
    );
    expect(dismissResponse.status).toEqual(204);

    // confirm invitee doesn't have access
    const removedAccessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/actions`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(removedAccessResponse.status).toEqual(404);
  }, 40000);
});
