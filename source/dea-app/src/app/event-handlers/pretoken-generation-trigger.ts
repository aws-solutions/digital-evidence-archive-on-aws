/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  DescribeGroupCommand,
  GetUserIdCommand,
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
const fipsSupported = getRequiredEnv('FIPS_SUPPORTED', 'false') === 'true';
const identityStoreId = getRequiredEnv('IDENTITY_STORE_ID');
const identityStoreRegion = getRequiredEnv('IDENTITY_STORE_REGION');
const identityStoreAccount = getRequiredEnv('IDENTITY_STORE_ACCOUNT');
const idCenterClient = new IdentitystoreClient({
  region: identityStoreRegion,
  useFipsEndpoint: fipsSupported,
  customUserAgent: getCustomUserAgent(),
});

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

  let userId = event.request.userAttributes['custom:IdCenterId'];

  // optional environment variables should be initialized within Lambda function to be validated during unit test
  const hasAwsManagedActiveDirectory =
    getRequiredEnv('HAS_AWS_MANAGED_ACTIVE_DIRECTORY').toLowerCase() === 'true';
  if (hasAwsManagedActiveDirectory) {
    /*
      When using Microsoft Active Directory as the identity store inside Identity Center, IdCenterId maps to ${dir:guid} 
      (aka. objectGUID), which is considered an "External Id" in ID Center and is a distinct value from UserId.
      Therefore, a reverse user lookup is needed to translate this external ID to the UserId Identity Center uses.
      https://docs.aws.amazon.com/singlesignon/latest/userguide/attributemappingsconcept.html#defaultattributemappings
    */
    const externalUserId = userId;
    if (!externalUserId) {
      throw new ValidationError(`External Active Directory ID is not set for user.`);
    }

    // Parse context for variables not in environment, can assume Lambda, Directory Service (AD), and ID Center share partition
    // since new partition requires new account. Although AD and ID Center must be in same region, this executing Lambda does not.
    const partition = _context.invokedFunctionArn.split(':')[1];

    const getUserIdResponse = await idCenterClient.send(
      new GetUserIdCommand({
        IdentityStoreId: identityStoreId,
        AlternateIdentifier: {
          ExternalId: {
            Issuer: `arn:${partition}:ds:${identityStoreRegion}:${identityStoreAccount}:directory/${identityStoreId}`,
            Id: externalUserId,
          },
        },
      })
    );

    if (!getUserIdResponse.UserId) {
      throw new ValidationError(`Unable to obtain user ID for user ${externalUserId}`);
    }
    userId = getUserIdResponse.UserId;
  } else {
    /*
      The user attribute "custom:IdCenterId" maps to AD_GUID in IAM Identity Center. When using Identity Center 
      as the identity store, IdCenterId maps directly to UsreId in Identity Center APIs and requires no translation.
      https://docs.aws.amazon.com/singlesignon/latest/userguide/attributemappingsconcept.html#defaultattributemappings
    */
    if (!userId) {
      throw new ValidationError(`Identity center id is not set for user.`);
    }
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
