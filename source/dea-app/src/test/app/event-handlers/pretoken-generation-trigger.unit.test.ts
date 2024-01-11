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
import { mockClient } from 'aws-sdk-client-mock';
import {
  PreTokenGenerationEvent,
  addGroupsClaimToToken,
} from '../../../app/event-handlers/pretoken-generation-trigger';

import { dummyContext } from '../../integration-objects';

// mock environment variables for Lambda
const originalEnv = process.env;

describe('pretoken generation trigger', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      // environment variables that are optional should be reset per test to mimic default value
      HAS_AWS_MANAGED_ACTIVE_DIRECTORY: Boolean(false).toString(),
    };
  });

  it('should add groups claim to token when not using Active Directory', async () => {
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

  it('should add groups claim to token when using Active Directory', async () => {
    process.env = {
      ...originalEnv,
      HAS_AWS_MANAGED_ACTIVE_DIRECTORY: Boolean(true).toString(),
    };

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
      .on(GetUserIdCommand)
      .resolvesOnce({
        UserId: 'userId',
        IdentityStoreId: 'd-1234567890'
      })
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

  it('should except for missing idCenterId when not using Active Directory', async () => {
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

  it('should except for missing idCenterId when using Active Directory', async () => {
    process.env = {
      ...originalEnv,
      HAS_AWS_MANAGED_ACTIVE_DIRECTORY: Boolean(true).toString(),
    };

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
    ).rejects.toThrow('External Active Directory ID is not set for user.');
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

  afterEach(() => {
    // reset Lambda environment to isolate unit tests
    process.env = originalEnv;
  });
});