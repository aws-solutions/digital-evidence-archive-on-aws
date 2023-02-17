/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Credentials } from 'aws4-axios';
import { DeaCase } from '../../models/case';
import { CaseAction } from '../../models/case-action';
import { CaseStatus } from '../../models/case-status';
import { CaseUserDTO } from '../../models/dtos/case-user-dto';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  bogusUlid,
  callDeaAPIWithCreds,
  createCaseSuccess,
  deleteCase,
  getSpecificUserByFirstName,
  randomSuffix,
} from './test-helpers';

describe('CaseMembership E2E', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testOwner = `createCaseMembership${suffix}-Owner`;
  const testInvitee = `createCaseMembership${suffix}-Invitee`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let targetCase: DeaCase;
  let inviteeUlid: string;

  const caseIdsToDelete: string[] = [];

  let ownerCreds: Credentials;
  let inviteeCreds: Credentials;
  let ownerToken: string;
  let inviteeToken: string;

  beforeAll(async () => {
    // Create user in test group
    await cognitoHelper.createUser(testOwner, 'CaseWorkerGroup', testOwner, 'TestUser');
    await cognitoHelper.createUser(testInvitee, 'CaseWorkerGroup', testInvitee, 'TestUser');

    [ownerCreds, ownerToken] = await cognitoHelper.getCredentialsForUser(testOwner);

    // initialize the invitee into the DB
    [inviteeCreds, inviteeToken] = await cognitoHelper.getCredentialsForUser(testInvitee);
    await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', inviteeToken, inviteeCreds);

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

  it('should CRUD CaseUsers', async () => {
    // confirm invitee doesn't have access
    const noAccessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(noAccessResponse.status).toEqual(404);

    // invite the user
    const newMembership: CaseUserDTO = {
      userUlid: inviteeUlid,
      caseUlid: targetCase.ulid!,
      actions: [CaseAction.VIEW_CASE_DETAILS],
    };
    const inviteResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
      'POST',
      ownerToken,
      ownerCreds,
      newMembership
    );
    expect(inviteResponse.status).toEqual(200);

    // confirm invitee has access
    const accessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(accessResponse.status).toEqual(200);

    // TODO confirm invitee cannot update

    // TODO update membership with case update permissions

    // TODO confirm update

    // Delete the membership
    const dismissResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships/${inviteeUlid}`,
      'DELETE',
      ownerToken,
      ownerCreds
    );
    expect(dismissResponse.status).toEqual(204);

    // confirm invitee doesn't have access
    const removedAccessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(removedAccessResponse.status).toEqual(404);
  }, 20000);

  describe('POST', () => {
    it('should give an error when payload is missing', async () => {
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
        'POST',
        ownerToken,
        ownerCreds
      );
      expect(inviteResponse.status).toEqual(400);
      expect(inviteResponse.data).toEqual('CaseUser payload missing.');
    });

    it('should give an error when path and resource ids do not match', async () => {
      const newMembership: CaseUserDTO = {
        userUlid: inviteeUlid,
        caseUlid: bogusUlid,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
        'POST',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(400);
      expect(inviteResponse.data).toEqual('Requested Case Ulid does not match resource');
    });

    it('should give an error when the user does not exist', async () => {
      const newMembership: CaseUserDTO = {
        userUlid: bogusUlid,
        caseUlid: targetCase.ulid!,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
        'POST',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(404);
      expect(inviteResponse.data).toEqual('User with ulid SVPERCA11FRAG111ST1CETCETC not found.');
    });

    it('should give an error when the case does not exist', async () => {
      const newMembership: CaseUserDTO = {
        userUlid: inviteeUlid,
        caseUlid: bogusUlid,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${bogusUlid}/userMemberships`,
        'POST',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(404);
      expect(inviteResponse.data).toEqual('Resource not found');
    });
  });

  describe('DELETE', () => {
    it('should return success if the case user does not exist', async () => {
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships/${bogusUlid}`,
        'DELETE',
        ownerToken,
        ownerCreds
      );
      expect(inviteResponse.status).toEqual(204);
    });
  });
});
