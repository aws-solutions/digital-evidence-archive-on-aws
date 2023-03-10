/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Credentials } from 'aws4-axios';
import Joi from 'joi';
import { DeaCase } from '../../models/case';
import { CaseAction } from '../../models/case-action';
import { CaseStatus } from '../../models/case-status';
import { CaseUser } from '../../models/case-user';
import { CaseUserDTO } from '../../models/dtos/case-user-dto';
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

describe('CaseMembership E2E', () => {
  const cognitoHelper = new CognitoHelper();

  const suffix = randomSuffix(5);
  const testOwner = `createCaseMembership${suffix}-Owner`;
  const testInvitee = `createCaseMembership${suffix}-Invitee`;
  const deaApiUrl = testEnv.apiUrlOutput;
  let targetCase: DeaCase;
  let inviteeUlid: string;
  let ownerUlid: string;

  const caseIdsToDelete: string[] = [];

  let ownerCreds: Credentials;
  let inviteeCreds: Credentials;
  let ownerToken: string;
  let inviteeToken: string;

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

    // confirm owner and invitee are returned in the membership list.
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
    expect(fetchedCases.find((caseuser) => caseuser.userUlid === ownerUlid)).toBeDefined();
    expect(fetchedCases.find((caseuser) => caseuser.userUlid === inviteeUlid)).toBeDefined();

    // confirm invitee has view access
    const accessResponse = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(accessResponse.status).toEqual(200);

    // confirm invitee cannot update the case (no update permission)
    const updatedDeaCase = {
      ulid: targetCase.ulid,
      name: `The Quary${suffix}-Updated`,
      description: 'Updated Description',
    };
    const updateAttempt = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}`,
      'PUT',
      inviteeToken,
      inviteeCreds,
      updatedDeaCase
    );
    expect(updateAttempt.status).toEqual(404);

    // in addition to the 404 above, confirm the case is unchanged
    const caseAfterFailedUpdate = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(caseAfterFailedUpdate.status).toEqual(200);
    const unchangedCase: DeaCase = caseAfterFailedUpdate.data;
    expect(unchangedCase.description).toBeFalsy();
    expect(unchangedCase.name.includes('Updated')).toBeFalsy();

    // Now update the invitee's membership, granting Update action
    const updatedMembership: CaseUserDTO = {
      userUlid: inviteeUlid,
      caseUlid: targetCase.ulid!,
      actions: [CaseAction.VIEW_CASE_DETAILS, CaseAction.UPDATE_CASE_DETAILS],
    };

    const grantUpdateAccess = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}/userMemberships/${inviteeUlid}`,
      'PUT',
      ownerToken,
      ownerCreds,
      updatedMembership
    );
    expect(grantUpdateAccess.status).toEqual(200);

    // Confirm invitee can now update the case
    const updateReattempt = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}`,
      'PUT',
      inviteeToken,
      inviteeCreds,
      updatedDeaCase
    );
    expect(updateReattempt.status).toEqual(200);

    // In addition to the 200 above, confirm changes were persisted
    const caseAfterUpdate = await callDeaAPIWithCreds(
      `${deaApiUrl}cases/${targetCase.ulid}`,
      'GET',
      inviteeToken,
      inviteeCreds
    );
    expect(caseAfterUpdate.status).toEqual(200);
    const changedCase: DeaCase = caseAfterUpdate.data;
    expect(changedCase.description).toEqual('Updated Description');
    expect(changedCase.name.includes('Updated')).toBeTruthy();

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
  }, 40000);

  describe('GET', () => {
    it('should give an error when the case does not exist', async () => {
      const membershipListResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${bogusUlid}/userMemberships`,
        'GET',
        ownerToken,
        ownerCreds
      );
      expect(membershipListResponse.status).toEqual(404);
      expect(membershipListResponse.data).toEqual('Resource not found');
    });
  });

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

  describe('PUT', () => {
    it('should produce an error when payload is missing', async () => {
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships/${inviteeUlid}`,
        'PUT',
        ownerToken,
        ownerCreds
      );
      expect(inviteResponse.status).toEqual(400);
      expect(inviteResponse.data).toEqual('CaseUser payload missing.');
    });

    it('should produce an error when the payload does not match expected schema', async () => {
      const newMembership = {
        userUlid: inviteeUlid,
        caseUlid: targetCase.ulid!,
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships/${inviteeUlid}`,
        'PUT',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(400);
      expect(inviteResponse.data).toEqual('"actions" is required');
    });

    it('should give an error when case path and resource ids do not match', async () => {
      const newMembership: CaseUserDTO = {
        userUlid: inviteeUlid,
        caseUlid: bogusUlid,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships/${inviteeUlid}`,
        'PUT',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(400);
      expect(inviteResponse.data).toEqual('Requested Case id does not match resource');
    });

    it('should give an error when user path and resource ids do not match', async () => {
      const newMembership: CaseUserDTO = {
        userUlid: bogusUlid,
        caseUlid: targetCase.ulid!,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships/${inviteeUlid}`,
        'PUT',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(400);
      expect(inviteResponse.data).toEqual('Requested User id does not match resource');
    });

    it('should give an error when the membership does not exist', async () => {
      const newMembership: CaseUserDTO = {
        userUlid: bogusUlid,
        caseUlid: targetCase.ulid!,
        actions: [CaseAction.VIEW_CASE_DETAILS],
      };
      const inviteResponse = await callDeaAPIWithCreds(
        `${deaApiUrl}cases/${targetCase.ulid}/userMemberships/${bogusUlid}`,
        'PUT',
        ownerToken,
        ownerCreds,
        newMembership
      );
      expect(inviteResponse.status).toEqual(404);
      expect(inviteResponse.data).toEqual('Requested Case-User Membership not found');
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
