/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Credentials } from 'aws4-axios';
import { DeaCase } from '../../models/case';
import { CaseAction } from '../../models/case-action';
import { DeaCaseFile } from '../../models/case-file';
import { DeaUser } from '../../models/user';
import { isDefined } from '../../persistence/persistence-helpers';
import CognitoHelper from '../helpers/cognito-helper';
import { testEnv } from '../helpers/settings';
import {
  callDeaAPIWithCreds,
  completeCaseFileUploadSuccess,
  createCaseSuccess,
  DeaHttpMethod,
  deleteCase,
  initiateCaseFileUploadSuccess,
  randomSuffix,
  uploadContentToS3,
} from './test-helpers';

export interface ACLTestHarness {
  owner: ACLTestUser;
  userWithRequiredActions: ACLTestUser;
  userWithAllButRequiredActions: ACLTestUser;
  userWithNoActions: ACLTestUser;
  userWithNoMembership: ACLTestUser;
  companionIds: string[];
  targetCase: DeaCase;
  ownerCaseFile?: DeaCaseFile;
  userCaseFile?: DeaCaseFile;
}

export interface ACLTestUser {
  userUlid: string;
  creds: Credentials;
  idToken: string;
  userName: string;
}

const cognitoHelper = new CognitoHelper();

const deaApiUrl = testEnv.apiUrlOutput;

export const validateEndpointACLs = (
  testSuiteName: string,
  requiredActions: ReadonlyArray<CaseAction>,
  endpoint: string,
  method: DeaHttpMethod,
  data?: string,
  createCompanionMemberships = false,
  testRequiresOwnerCaseFile = false,
  testRequiresUserCaseFile = false,
  testRequiresDownload = false
) => {
  describe(testSuiteName, () => {
    let testHarness: ACLTestHarness;
    let targetUrl: string;

    beforeAll(async () => {
      testHarness = await initializeACLE2ETest('caseDetailACL', requiredActions);
      targetUrl = `${deaApiUrl}${endpoint}`;
      targetUrl = targetUrl.replace('{caseId}', testHarness.targetCase.ulid!);
      if (data) {
        data = data.replace('{caseId}', testHarness.targetCase.ulid!);
        data = data.replace('{rand}', randomSuffix());
      }

      if (createCompanionMemberships) {
        const membershipData = JSON.stringify({
          userUlid: '{companion}',
          caseUlid: testHarness.targetCase.ulid,
          actions: [],
        });
        for (let i = 0; i <= 4; ++i) {
          const postEndpoint = `${deaApiUrl}cases/${testHarness.targetCase.ulid}/userMemberships`;
          const postData = membershipData?.replace('{companion}', testHarness.companionIds[i]);

          const cr = await callDeaAPIWithCreds(
            postEndpoint,
            'POST',
            testHarness.owner.idToken,
            testHarness.owner.creds,
            postData
          );
          expect(cr.status).toEqual(200);
        }
      }

      if (testRequiresOwnerCaseFile) {
        testHarness.ownerCaseFile = await initiateCaseFileUploadSuccess(
          deaApiUrl,
          testHarness.owner.idToken,
          testHarness.owner.creds,
          testHarness.targetCase.ulid,
          `${randomSuffix()}`,
          `/`,
          1
        );

        await uploadContentToS3(testHarness.ownerCaseFile.presignedUrls ?? fail(), 'hello world');
        if (testRequiresDownload) {
          await completeCaseFileUploadSuccess(
            deaApiUrl,
            testHarness.owner.idToken,
            testHarness.owner.creds,
            testHarness.targetCase.ulid,
            testHarness.ownerCaseFile.ulid,
            testHarness.ownerCaseFile.uploadId,
            'hello world'
          );
        }
      }

      if (testRequiresUserCaseFile) {
        // this block is needed because complete-upload can only be called by user who initiated upload
        testHarness.userCaseFile = await initiateCaseFileUploadSuccess(
          deaApiUrl,
          testHarness.userWithRequiredActions.idToken,
          testHarness.userWithRequiredActions.creds,
          testHarness.targetCase.ulid,
          `${randomSuffix()}`,
          '/',
          1
        );
        await uploadContentToS3(testHarness.userCaseFile.presignedUrls ?? fail(), 'hello world');
      }
    }, 30000);

    afterAll(async () => {
      await cleanupTestHarness(testHarness);
    });

    it('should allow access to the owner', async () => {
      let ownerUrl = targetUrl;
      let ownerData = data;
      if (testHarness.ownerCaseFile) {
        ownerUrl = ownerUrl.replace('{fileId}', testHarness.ownerCaseFile.ulid!);
        if (ownerData) {
          ownerData = ownerData.replace('{fileId}', testHarness.ownerCaseFile.ulid!);
          ownerData = ownerData.replace('{uploadId}', testHarness.ownerCaseFile.uploadId!);
        }
      }

      const response = await callDeaAPIWithCreds(
        ownerUrl.replace('{companion}', testHarness.companionIds[0]),
        method,
        testHarness.owner.idToken,
        testHarness.owner.creds,
        ownerData?.replace('{companion}', testHarness.companionIds[0])
      );

      if (response.status > 300) {
        console.log(response);
      }
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
    });

    it('should allow access to a user with all required actions', async () => {
      let userUrl = targetUrl;
      let userData = data;
      let caseFileToUse: DeaCaseFile | undefined;

      if (testRequiresUserCaseFile) {
        caseFileToUse = testHarness.userCaseFile;
      } else {
        caseFileToUse = testHarness.ownerCaseFile;
      }

      if (caseFileToUse) {
        userUrl = userUrl.replace('{fileId}', caseFileToUse.ulid!);
        if (userData) {
          userData = userData.replace('{fileId}', caseFileToUse.ulid!);
          userData = userData.replace('{uploadId}', caseFileToUse.uploadId!);
        }
      }

      const response = await callDeaAPIWithCreds(
        userUrl.replace('{companion}', testHarness.companionIds[1]),
        method,
        testHarness.userWithRequiredActions.idToken,
        testHarness.userWithRequiredActions.creds,
        userData?.replace('{companion}', testHarness.companionIds[1])
      );
      if (response.status > 300) {
        console.log(response);
      }
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
    });

    it('should deny access to a user with all except the required actions', async () => {
      let invertedPermsUrl = targetUrl;
      if (testHarness.ownerCaseFile) {
        invertedPermsUrl = invertedPermsUrl.replace('{fileId}', testHarness.ownerCaseFile.ulid!);
      }

      const response = await callDeaAPIWithCreds(
        invertedPermsUrl.replace('{companion}', testHarness.companionIds[2]),
        method,
        testHarness.userWithAllButRequiredActions.idToken,
        testHarness.userWithAllButRequiredActions.creds,
        data?.replace('{companion}', testHarness.companionIds[2])
      );
      expect(response.status).toEqual(404);
    });

    it('should deny access to a user with no actions', async () => {
      let noPermsUrl = targetUrl;
      if (testHarness.ownerCaseFile) {
        noPermsUrl = noPermsUrl.replace('{fileId}', testHarness.ownerCaseFile.ulid!);
      }

      const response = await callDeaAPIWithCreds(
        noPermsUrl.replace('{companion}', testHarness.companionIds[3]),
        method,
        testHarness.userWithNoActions.idToken,
        testHarness.userWithNoActions.creds,
        data?.replace('{companion}', testHarness.companionIds[3])
      );
      expect(response.status).toEqual(404);
    });

    it('should deny access to a user with no membership', async () => {
      let noMembershipUrl = targetUrl;
      if (testHarness.ownerCaseFile) {
        noMembershipUrl = noMembershipUrl.replace('{fileId}', testHarness.ownerCaseFile.ulid!);
      }

      const response = await callDeaAPIWithCreds(
        noMembershipUrl.replace('{companion}', testHarness.companionIds[4]),
        method,
        testHarness.userWithNoMembership.idToken,
        testHarness.userWithNoMembership.creds,
        data?.replace('{companion}', testHarness.companionIds[4])
      );
      expect(response.status).toEqual(404);
    });
  });
};

const initializeACLE2ETest = async (
  testSuiteName: string,
  requiredActions: ReadonlyArray<CaseAction>
): Promise<ACLTestHarness> => {
  const prefix = randomSuffix(5);
  const companionSuffix = '-companion';
  const ownerName = `${prefix}_owner_${testSuiteName}`;
  const userWithRequiredActionsName = `${prefix}_requiredActions_${testSuiteName}`;
  const userWithAllButRequiredActionsName = `${prefix}_allButRequiredActions_${testSuiteName}`;
  const userWithNoActionsName = `${prefix}_noActions_${testSuiteName}`;
  const userWithNoMembershipName = `${prefix}_noMembership_${testSuiteName}`;

  const testUsernames = [
    ownerName,
    userWithRequiredActionsName,
    userWithAllButRequiredActionsName,
    userWithNoActionsName,
    userWithNoMembershipName,
  ];

  // create the required users in cognito
  const createUserPromises: Promise<void>[] = [];
  for (const userName of testUsernames) {
    createUserPromises.push(cognitoHelper.createUser(userName, 'CaseWorkerGroup', userName, 'Doe'));
    // each user under test gets a companion that they may act on
    createUserPromises.push(
      cognitoHelper.createUser(
        `${userName}${companionSuffix}`,
        'CaseWorkerGroup',
        `${userName}${companionSuffix}`,
        'Doe'
      )
    );
  }
  await Promise.all(createUserPromises);

  const credsMap = new Map<string, [Credentials, string]>();

  // Initialize the users in the Database
  const initUserPromises: Promise<unknown>[] = [];
  for (const userName of testUsernames) {
    const [creds, idToken] = await cognitoHelper.getCredentialsForUser(userName);
    credsMap.set(userName, [creds, idToken]);
    initUserPromises.push(callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', idToken, creds));
    // initialize the companion
    const [ccreds, cidToken] = await cognitoHelper.getCredentialsForUser(`${userName}${companionSuffix}`);
    initUserPromises.push(callDeaAPIWithCreds(`${deaApiUrl}cases/my-cases`, 'GET', cidToken, ccreds));
  }
  await Promise.all(initUserPromises);

  const [ownerCreds, ownerToken] = credsMap.get(ownerName)!;
  const userResponse = await callDeaAPIWithCreds(
    `${deaApiUrl}users?nameBeginsWith=${prefix}`,
    'GET',
    ownerToken,
    ownerCreds
  );

  expect(userResponse.status).toEqual(200);
  const fetchedUsers: DeaUser[] = await userResponse.data.users;

  const createdCase = await createCaseSuccess(
    deaApiUrl,
    {
      name: `targetCase_${testSuiteName}`,
      description: 'this is a description',
    },
    ownerToken,
    ownerCreds
  );

  const companionNames = [
    `${ownerName}${companionSuffix}`,
    `${userWithRequiredActionsName}${companionSuffix}`,
    `${userWithAllButRequiredActionsName}${companionSuffix}`,
    `${userWithNoActionsName}${companionSuffix}`,
    `${userWithNoMembershipName}${companionSuffix}`,
  ];

  const harness = {
    owner: getACLTestUser(ownerName, fetchedUsers, credsMap),
    userWithRequiredActions: getACLTestUser(userWithRequiredActionsName, fetchedUsers, credsMap),
    userWithAllButRequiredActions: getACLTestUser(userWithAllButRequiredActionsName, fetchedUsers, credsMap),
    userWithNoActions: getACLTestUser(userWithNoActionsName, fetchedUsers, credsMap),
    userWithNoMembership: getACLTestUser(userWithNoMembershipName, fetchedUsers, credsMap),
    companionIds: fetchedUsers
      .filter((user) => companionNames.includes(user.firstName))
      .map((user) => user.ulid)
      .filter(isDefined),
    targetCase: createdCase,
  };

  const membershipPromises: Promise<unknown>[] = [];
  // userWithRequiredActions
  membershipPromises.push(
    callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/userMemberships`,
      'POST',
      ownerToken,
      ownerCreds,
      {
        userUlid: harness.userWithRequiredActions.userUlid,
        caseUlid: createdCase.ulid,
        actions: requiredActions,
      }
    )
  );
  // userWithAllButRequiredActions
  membershipPromises.push(
    callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/userMemberships`,
      'POST',
      ownerToken,
      ownerCreds,
      {
        userUlid: harness.userWithAllButRequiredActions.userUlid,
        caseUlid: createdCase.ulid,
        actions: Object.values(CaseAction).filter((action) => !requiredActions.includes(action)),
      }
    )
  );
  // userWithNoActions
  membershipPromises.push(
    callDeaAPIWithCreds(
      `${deaApiUrl}cases/${createdCase.ulid}/userMemberships`,
      'POST',
      ownerToken,
      ownerCreds,
      {
        userUlid: harness.userWithAllButRequiredActions.userUlid,
        caseUlid: createdCase.ulid,
        actions: [],
      }
    )
  );

  await Promise.all(membershipPromises);

  return harness;
};

const cleanupTestHarness = async (testHarnes: ACLTestHarness): Promise<void> => {
  await deleteCase(deaApiUrl, testHarnes.targetCase.ulid!, testHarnes.owner.idToken, testHarnes.owner.creds);

  const cleanupPromises: Promise<unknown>[] = [];
  cleanupPromises.push(cognitoHelper.deleteUser(testHarnes.owner.userName));
  cleanupPromises.push(cognitoHelper.deleteUser(testHarnes.userWithRequiredActions.userName));
  cleanupPromises.push(cognitoHelper.deleteUser(testHarnes.userWithAllButRequiredActions.userName));
  cleanupPromises.push(cognitoHelper.deleteUser(testHarnes.userWithNoActions.userName));
  cleanupPromises.push(cognitoHelper.deleteUser(testHarnes.userWithNoMembership.userName));
  await Promise.all(cleanupPromises);
};

function getACLTestUser(
  userName: string,
  users: DeaUser[],
  credsMap: Map<string, [Credentials, string]>
): ACLTestUser {
  const [creds, idToken] = credsMap.get(userName)!;
  return {
    userUlid: users.find((user) => user.firstName === userName)!.ulid!,
    creds,
    idToken,
    userName,
  };
}
