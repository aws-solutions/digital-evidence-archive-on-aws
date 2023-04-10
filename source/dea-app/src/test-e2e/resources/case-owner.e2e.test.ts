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
import { CaseOwnerDTO, CaseUserDTO } from '../../models/dtos/case-user-dto';
import { caseUserResponseSchema } from '../../models/validation/case-user';
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

describe('CaseOwner E2E', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testOwner = `createCaseOwner${suffix}-Owner`;
  const testInvitee = `createCaseOwner${suffix}-Invitee`;
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
    // Create user
    await cognitoHelper.createUser(testOwner, 'WorkingManager', testOwner, 'TestUser');
    await cognitoHelper.createUser(testInvitee, 'CaseWorker', testInvitee, 'TestUser');

    [ownerCreds, ownerToken] = await cognitoHelper.getCredentialsForUser(testOwner);

    // initialize the invitee into the DB
    [inviteeCreds, inviteeToken] = await cognitoHelper.getCredentialsForUser(testInvitee);
    await callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', inviteeToken, inviteeCreds);

    // get owner ulid
    ownerUlid = (await getSpecificUserByFirstName(deaApiUrl, testOwner, ownerToken, ownerCreds)).ulid!;

    // get invitee ulid
    inviteeUlid = (await getSpecificUserByFirstName(deaApiUrl, testInvitee, ownerToken, ownerCreds)).ulid!;
  }, 30000);

  afterAll(async () => {
    for (const caseId of caseIdsToDelete) {
      await deleteCase(deaApiUrl, caseId, ownerToken, ownerCreds);
    }
    await cognitoHelper.cleanup();
  }, 30000);

  it('should create a membership with "owner" relevant permission(s) if does not exist', async () => {
    // create the case
    const deaCase = {
      name: `First${suffix}`,
      status: CaseStatus.ACTIVE,
    };
    targetCase = await createCaseSuccess(deaApiUrl, deaCase, ownerToken, ownerCreds);
    caseIdsToDelete.push(targetCase.ulid!);
    // confirm owner is only returned in the membership list
    const membershipSingleItemResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
      'GET',
      ownerToken,
      ownerCreds
    );
    expect(membershipSingleItemResponse.status).toEqual(200);

    const singleItemList: CaseUser[] = await membershipSingleItemResponse.data.caseUsers;
    expect(singleItemList.length).toBe(1);
    singleItemList.forEach((fetchedCase) => Joi.assert(fetchedCase, caseUserResponseSchema));
    singleItemList.forEach((fetchedCase) => fetchedCase.actions.join('|') === OWNER_ACTIONS.join('|'));

    // invite the user as case owner
    const caseOwnerDTO: CaseOwnerDTO = {
      userUlid: inviteeUlid,
      caseUlid: targetCase.ulid!,
    };
    const inviteResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/owner`,
      'POST',
      ownerToken,
      ownerCreds,
      caseOwnerDTO
    );
    expect(inviteResponse.status).toEqual(200);

    // confirm owner and invitee are returned in the membership list with "owner" relevant permission(s)
    const membershipListResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
      'GET',
      ownerToken,
      ownerCreds
    );
    expect(membershipListResponse.status).toEqual(200);

    const fetchedCases: CaseUser[] = await membershipListResponse.data.caseUsers;
    expect(fetchedCases.length).toBe(2);
    fetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseUserResponseSchema));
    fetchedCases.forEach((fetchedCase) => fetchedCase.actions.join('|') === OWNER_ACTIONS.join('|'));

    // confirm invitee can access to the case details
    const accessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(accessResponse.status).toEqual(200);

    // Confirm invitee can update the case
    const updatedDeaCase = {
      ulid: targetCase.ulid,
      name: `First${suffix}-Updated`,
      description: 'Updated Description',
    };
    const updateReattempt = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'PUT',
      inviteeToken,
      inviteeCreds,
      updatedDeaCase
    );
    expect(updateReattempt.status).toEqual(200);

    // In addition to the 200 above, confirm changes were persisted
    const caseAfterUpdate = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(caseAfterUpdate.status).toEqual(200);
    const changedCase: DeaCase = caseAfterUpdate.data;
    expect(changedCase.description).toEqual('Updated Description');
    expect(changedCase.name.includes('Updated')).toBeTruthy();

    // Clean up - Delete the membership
    const dismissResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/users/${inviteeUlid}/memberships`,
      'DELETE',
      ownerToken,
      ownerCreds
    );
    expect(dismissResponse.status).toEqual(204);

    // confirm invitee doesn't have access
    const removedAccessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(removedAccessResponse.status).toEqual(404);
  }, 40000);

  it('should update the membership with "owner" relevant permission(s) if does exist', async () => {
    // create the case
    const deaCase = {
      name: `Second${suffix}`,
      status: CaseStatus.ACTIVE,
    };
    targetCase = await createCaseSuccess(deaApiUrl, deaCase, ownerToken, ownerCreds);
    caseIdsToDelete.push(targetCase.ulid!);
    // confirm owner is only returned in the membership list
    const membershipSingleItemResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
      'GET',
      ownerToken,
      ownerCreds
    );
    expect(membershipSingleItemResponse.status).toEqual(200);

    const singleItemList: CaseUser[] = await membershipSingleItemResponse.data.caseUsers;
    expect(singleItemList.length).toBe(1);
    singleItemList.forEach((fetchedCase) => Joi.assert(fetchedCase, caseUserResponseSchema));
    singleItemList.forEach((fetchedCase) => fetchedCase.actions.join('|') === OWNER_ACTIONS.join('|'));

    // invite the user, granting just the "view" permission
    const viewOnlyPermissions = [CaseAction.VIEW_CASE_DETAILS];
    const viewOnlyMembership: CaseUserDTO = {
      userUlid: inviteeUlid,
      caseUlid: targetCase.ulid!,
      actions: viewOnlyPermissions,
    };
    const grantViewAccess = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
      'POST',
      ownerToken,
      ownerCreds,
      viewOnlyMembership
    );
    expect(grantViewAccess.status).toEqual(200);

    // confirm the invitee has just the "view" permission
    const membershipWithInviteeResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
      'GET',
      ownerToken,
      ownerCreds
    );
    expect(membershipWithInviteeResponse.status).toEqual(200);
    const fetchedWithInviteeCases: CaseUser[] = await membershipWithInviteeResponse.data.caseUsers;
    expect(fetchedWithInviteeCases.length).toBe(2);
    fetchedWithInviteeCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseUserResponseSchema));
    const caseOwnerEntry = fetchedWithInviteeCases.find((caseuser) => caseuser.userUlid === ownerUlid);
    expect(caseOwnerEntry).toBeDefined();
    expect(caseOwnerEntry?.actions).toEqual(expect.arrayContaining(OWNER_ACTIONS));
    const inviteeEntry = fetchedWithInviteeCases.find((caseuser) => caseuser.userUlid === inviteeUlid);
    expect(inviteeEntry).toBeDefined();
    expect(inviteeEntry?.actions).toEqual(expect.arrayContaining(viewOnlyPermissions));

    // confirm invitee can access to the case details
    const accessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(accessResponse.status).toEqual(200);

    // confirm invitee cannot update the case (no update permission)
    const updatedDeaCase = {
      ulid: targetCase.ulid,
      name: `Second${suffix}-Updated`,
      description: 'Updated Description',
    };
    const updateAttempt = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'PUT',
      inviteeToken,
      inviteeCreds,
      updatedDeaCase
    );
    expect(updateAttempt.status).toEqual(404);

    // in addition to the 404 above, confirm the case is unchanged
    const caseAfterFailedUpdate = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(caseAfterFailedUpdate.status).toEqual(200);
    const unchangedCase: DeaCase = caseAfterFailedUpdate.data;
    expect(unchangedCase.description).toBeFalsy();
    expect(unchangedCase.name.includes('Updated')).toBeFalsy();

    // invite the user as case owner
    const caseOwnerDTO: CaseOwnerDTO = {
      userUlid: inviteeUlid,
      caseUlid: targetCase.ulid!,
    };
    const inviteResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/owner`,
      'POST',
      ownerToken,
      ownerCreds,
      caseOwnerDTO
    );
    expect(inviteResponse.status).toEqual(200);

    // confirm owner and invitee are returned in the membership list with "owner" relevant permission(s)
    const membershipListResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships`,
      'GET',
      ownerToken,
      ownerCreds
    );
    expect(membershipListResponse.status).toEqual(200);

    const fetchedCases: CaseUser[] = await membershipListResponse.data.caseUsers;
    expect(fetchedCases.length).toBe(2);
    fetchedCases.forEach((fetchedCase) => Joi.assert(fetchedCase, caseUserResponseSchema));
    fetchedCases.forEach((fetchedCase) =>
      expect(fetchedCase?.actions).toEqual(expect.arrayContaining(OWNER_ACTIONS))
    );

    // Confirm invitee can now update the case
    const updateReattempt = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'PUT',
      inviteeToken,
      inviteeCreds,
      updatedDeaCase
    );
    expect(updateReattempt.status).toEqual(200);

    // In addition to the 200 above, confirm changes were persisted
    const caseAfterUpdate = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(caseAfterUpdate.status).toEqual(200);
    const changedCase: DeaCase = caseAfterUpdate.data;
    expect(changedCase.description).toEqual('Updated Description');

    // Clean up - Delete the membership
    const dismissResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/users/${inviteeUlid}/memberships`,
      'DELETE',
      ownerToken,
      ownerCreds
    );
    expect(dismissResponse.status).toEqual(204);

    // confirm invitee doesn't have access
    const removedAccessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/details`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(removedAccessResponse.status).toEqual(404);
  }, 40000);

  describe('POST', () => {
    it('should give an error when payload is missing', async () => {
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/owner`,
        'POST',
        ownerToken,
        ownerCreds
      );
      expect(inviteResponse.status).toEqual(400);
      expect(inviteResponse.data).toEqual('CaseOwner payload missing.');
    });

    it('should give an error when path and resource ids do not match', async () => {
      const newMembership: CaseOwnerDTO = {
        userUlid: inviteeUlid,
        caseUlid: bogusUlid,
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/owner`,
        'POST',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(400);
      expect(inviteResponse.data).toEqual('Requested Case Ulid does not match resource');
    });

    it('should give an error when the user does not exist', async () => {
      const newMembership: CaseOwnerDTO = {
        userUlid: bogusUlid,
        caseUlid: targetCase.ulid!,
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/owner`,
        'POST',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(404);
      expect(inviteResponse.data).toEqual('User with ulid SVPERCA11FRAG111ST1CETCETC not found.');
    });

    it('should give an error when the case does not exist', async () => {
      const newMembership: CaseOwnerDTO = {
        userUlid: inviteeUlid,
        caseUlid: bogusUlid,
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${bogusUlid}/owner`,
        'POST',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(404);
      expect(inviteResponse.data).toEqual(`Case with ulid ${bogusUlid} not found.`);
    });
  });
});
