/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  DescribeGroupCommand,
  IdentitystoreClient,
  ListGroupMembershipsForMemberCommand,
} from '@aws-sdk/client-identitystore';
import { Callback, Context } from 'aws-lambda';
import { getCustomUserAgent, getRequiredEnv } from '../../lambda-http-helpers';
import { logger } from '../../logger';
import { ValidationError } from '../exceptions/validation-exception';

/*
    In Identity Center you cannot send a custom attribute or user groups in the SAML
    assertion during federation. Therefore, when you use Identity Center as your Identity 
    Provider, this Pre-Token Generation Lambda Trigger will run, query the user groups from
    identity center and add the groups to the claims on the identity token. Authorization
    will proceed like normal (e.g. the same as Okta and AD), since the claims will be on the token.
*/

const identityStoreId = getRequiredEnv('IDENTITY_STORE_ID');
const region = getRequiredEnv('AWS_REGION');
const idCenterClient = new IdentitystoreClient({ region, customUserAgent: getCustomUserAgent() });

export interface PreTokenGenerationEvent {
  triggerSource?: string;
  userPoolId?: string;
  request: {
    userAttributes: { [key: string]: string };
    groupConfiguration: {
      groupsToOverride: string[];
      iamRolesToOverride: string[];
      preferredRole: string[] | null;
    };
  };

  response: {
    claimsOverrideDetails?: {
      claimsToAddOrOverride?: { [key: string]: string };
      claimsToSuppress?: string[];

      groupOverrideDetails?: {
        groupsToOverride?: string[];
        iamRolesToOverride?: string[];
        preferredRole?: string;
      };
    } | null;
  };
}

export type PreTokenGenerationSignature = (
  event: PreTokenGenerationEvent,
  _context: Context,
  _callback: Callback
) => Promise<PreTokenGenerationEvent>;

export const addGroupsClaimToToken: PreTokenGenerationSignature = async (
  event: PreTokenGenerationEvent,
  _context: Context,
  _callback: Callback
) => {
  logger.debug('Event', { Data: JSON.stringify(event, null, 2) });

  const userId = event.request.userAttributes['custom:IdCenterId'];

  if (!userId) {
    throw new ValidationError(`Identity center id is not set for user.`);
  }

  const groups = (await getGroupNamesForUser(userId)).join(',');

  event.response = {
    claimsOverrideDetails: {
      claimsToAddOrOverride: {
        'custom:SAMLGroups': groups,
      },
    },
  };
  return event;
};

const getGroupNamesForUser = async (userId: string) => {
  // Get User Groups
  const groupMembershipsResponse = await idCenterClient.send(
    new ListGroupMembershipsForMemberCommand({
      IdentityStoreId: identityStoreId,
      MemberId: {
        UserId: userId,
      },
    })
  );

  if (!groupMembershipsResponse.GroupMemberships) {
    throw new ValidationError(`Unable to obtain group membership for user ${userId}`);
  }

  // For each group, query the group name
  const groupIds = groupMembershipsResponse.GroupMemberships.map((group) => group.GroupId);
  const groupNamesPromises = groupIds.map((id) =>
    idCenterClient.send(
      new DescribeGroupCommand({
        GroupId: id,
        IdentityStoreId: identityStoreId,
      })
    )
  );

  const groupNames = (await Promise.all(groupNamesPromises)).map((groupDesc) => groupDesc.DisplayName);
  return groupNames;
};
