/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  DescribeGroupCommand,
  IdentitystoreClient,
  ListGroupMembershipsForMemberCommand,
} from '@aws-sdk/client-identitystore';
import { mockClient } from 'aws-sdk-client-mock';
import {
  PreTokenGenerationEvent,
  addGroupsClaimToToken,
} from '../../../app/event-handlers/pretoken-generation-trigger';
import { dummyContext } from '../../integration-objects';

describe('pretoken generation trigger', () => {
  it('should add groups claim to token', async () => {
    const token: PreTokenGenerationEvent = {
      request: {
        userAttributes: {
          'custom:IdCenterId': 'someid',
        },
        groupConfiguration: {
          groupsToOverride: [],
          iamRolesToOverride: [],
          preferredRole: [],
        },
      },
      response: {},
    };

    const idstoreClientMock = mockClient(IdentitystoreClient);
    idstoreClientMock
      .on(ListGroupMembershipsForMemberCommand)
      .resolvesOnce({
        GroupMemberships: [{ GroupId: 'groupId', IdentityStoreId: undefined }],
      })
      .on(DescribeGroupCommand)
      .resolvesOnce({
        DisplayName: 'group1',
      });

    const result = await addGroupsClaimToToken(token, dummyContext, () => {
      /* do nothing */
    });
    expect(result.response.claimsOverrideDetails?.claimsToAddOrOverride?.['custom:SAMLGroups']).toEqual(
      'group1'
    );
  });

  it('should except for missing idCenterId', async () => {
    const token: PreTokenGenerationEvent = {
      request: {
        userAttributes: {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore. just let me break it bro
          'custom:IdCenterId': undefined,
        },
        groupConfiguration: {
          groupsToOverride: [],
          iamRolesToOverride: [],
          preferredRole: [],
        },
      },
      response: {},
    };

    await expect(
      addGroupsClaimToToken(token, dummyContext, () => {
        /* do nothing */
      })
    ).rejects.toThrow('Identity center id is not set for user.');
  });

  it('should except for missing group membership', async () => {
    const token: PreTokenGenerationEvent = {
      request: {
        userAttributes: {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore. just let me break it bro
          'custom:IdCenterId': 'bogusid',
        },
        groupConfiguration: {
          groupsToOverride: [],
          iamRolesToOverride: [],
          preferredRole: [],
        },
      },
      response: {},
    };

    const idstoreClientMock = mockClient(IdentitystoreClient);
    idstoreClientMock.on(ListGroupMembershipsForMemberCommand).resolvesOnce({
      GroupMemberships: undefined,
    });

    await expect(
      addGroupsClaimToToken(token, dummyContext, () => {
        /* do nothing */
      })
    ).rejects.toThrow(`Unable to obtain group membership for user bogusid`);
  });
});
