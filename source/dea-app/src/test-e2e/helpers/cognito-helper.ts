/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AuthenticationResultType,
  AuthFlowType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { Credentials } from 'aws4-axios';
import { getTokenPayload } from '../../cognito-token-helpers';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { deleteUser, getUserByTokenId } from '../../persistence/user';
import { envSettings } from './settings';

export default class CognitoHelper {
  private _identityPoolClient: CognitoIdentityClient;
  private _userPoolProvider: CognitoIdentityProviderClient;
  private _region: string;
  readonly _userPoolClientId: string;
  readonly _userPoolId: string;
  private _identityPoolId: string;
  readonly _idpUrl: string;

  private _usersCreated: string[] = [];
  private _testPassword: string;

  public constructor() {
    this._region = envSettings.awsRegion;
    this._userPoolId = envSettings.userPoolId;
    this._userPoolClientId = envSettings.clientId;
    this._identityPoolId = envSettings.identityPoolId;

    this._idpUrl = `cognito-idp.${this._region}.amazonaws.com/${this._userPoolId}`;

    this._identityPoolClient = new CognitoIdentityClient({ region: this._region });
    this._userPoolProvider = new CognitoIdentityProviderClient({ region: this._region });

    this._testPassword = generatePassword();
  }

  public async createUser(
    userName: string,
    groupName: string,
    firstName: string,
    lastName: string
  ): Promise<void> {
    // 1. Create User
    try {
      const user = await this._userPoolProvider.send(
        new AdminCreateUserCommand({
          UserPoolId: this._userPoolId,
          MessageAction: MessageActionType.SUPPRESS,
          Username: userName,
          TemporaryPassword: generatePassword(),
          UserAttributes: [
            {
              Name: 'given_name',
              Value: firstName,
            },
            {
              Name: 'family_name',
              Value: lastName,
            },
          ],
        })
      );
      if (user.User?.Username) {
        this._usersCreated.push(user.User.Username);

        // 2. Change Password
        const command = new AdminSetUserPasswordCommand({
          Password: this._testPassword,
          Permanent: true,
          Username: userName,
          UserPoolId: this._userPoolId,
        });
        await this._userPoolProvider.send(command);
      } else {
        throw new Error('Failed to create user with username: ' + user);
      }
    } catch (error) {
      console.log('Failed to create user ' + error);
      return;
    }

    // 3. Add to Cognito Group
    try {
      await this._userPoolProvider.send(
        new AdminAddUserToGroupCommand({
          Username: userName,
          UserPoolId: this._userPoolId,
          GroupName: groupName,
        })
      );
    } catch (error) {
      console.log('Failed to add to Cognito group ' + error);
      return;
    }
  }

  public async getUser(userName: string): Promise<boolean> {
    try {
      await this._userPoolProvider.send(
        new AdminGetUserCommand({
          Username: userName,
          UserPoolId: this._userPoolId,
        })
      );
      return true;
    } catch (error) {
      console.log('Could not find user ' + error);
      return false;
    }
  }

  private async getUserPoolAuthForUser(userName: string): Promise<AuthenticationResultType> {
    const result = await this._userPoolProvider.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: userName,
          PASSWORD: this._testPassword,
        },
        ClientId: this._userPoolClientId,
      })
    );

    if (!result.AuthenticationResult) {
      throw new Error('Unable to authenticate with the user pool.');
    }

    return result.AuthenticationResult;
  }

  public async getIdTokenForUser(userName: string): Promise<string> {
    const result = await this.getUserPoolAuthForUser(userName);

    if (!result.IdToken) {
      throw new Error('Unable to get id token from user pool.');
    }

    return result.IdToken;
  }

  public async getCredentialsForUser(userName: string): Promise<[Credentials, string]> {
    // 1. Authenticate with User Pool, get Token
    const idToken = await this.getIdTokenForUser(userName);

    // 2. Get Identity from Identity Pool
    const identityId = await this._identityPoolClient.send(
      new GetIdCommand({
        IdentityPoolId: this._identityPoolId,
        Logins: {
          [this._idpUrl]: idToken,
        },
      })
    );

    // 3. Get Credentials from the Identity Pool
    const response = await this._identityPoolClient.send(
      new GetCredentialsForIdentityCommand({
        IdentityId: identityId.IdentityId,
        Logins: {
          [this._idpUrl]: idToken,
        },
      })
    );

    if (!response.Credentials) {
      throw new Error('Failed to get credentials from the identity pool: ' + response);
    }
    const creds = response.Credentials;
    if (creds.AccessKeyId && creds.SecretKey && creds.SessionToken) {
      return [
        {
          accessKeyId: creds.AccessKeyId,
          secretAccessKey: creds.SecretKey,
          sessionToken: creds.SessionToken,
        },
        idToken,
      ];
    } else {
      throw new Error('Failed to get credentials from the identity pool:');
    }
  }

  public async cleanup(repositoryProvider?: ModelRepositoryProvider): Promise<void> {
    // Clean the users made
    await Promise.all(
      this._usersCreated.map(async (username) => {
        // try to remove the user from the db
        // NOTE: it won't be there unless you called
        // lambda using creds from the the user
        const idToken = await this.getIdTokenForUser(username);
        const tokenId = (await getTokenPayload(idToken, this._region)).sub;
        if (repositoryProvider) {
          const dbUser = await getUserByTokenId(tokenId, repositoryProvider);
          if (dbUser) {
            await deleteUser(dbUser.ulid ?? fail(), repositoryProvider);
          }
        }

        // Now delete the user from the user pool
        await this._userPoolProvider.send(
          new AdminDeleteUserCommand({
            Username: username,
            UserPoolId: this._userPoolId,
          })
        );
      })
    );

    this._usersCreated = []; // This way if the cleanup() method is called again, we don't need to cleanup again

    if (this._identityPoolClient) {
      this._identityPoolClient.destroy();
    }

    if (this._userPoolProvider) {
      this._userPoolProvider.destroy();
    }
  }
}

function generatePassword(): string {
  const lowerCaseKeySet = 'abcdefghijklmnopqrstuvwxyz';
  const upperCaseKeySet = lowerCaseKeySet.toUpperCase();
  const numberKeySet = '123456789';
  const specialKeySet = '!@#_';

  // Need min length of 8, with one upper, one lower case letter, one number,
  // and a special symbol
  const unshuffledPassword: string[] = [];
  // Add 2 from each keyset to make 8 characters
  for (const keyset of [lowerCaseKeySet, upperCaseKeySet, numberKeySet, specialKeySet]) {
    unshuffledPassword.push(getRandomCharacter(keyset));
    unshuffledPassword.push(getRandomCharacter(keyset));
  }

  // now randomize the ordering and return as a string
  return unshuffledPassword
    .map((character) => ({ character, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ character }) => character)
    .join('');
}

function getRandomCharacter(keySet: string): string {
  const keySetSize = keySet.length;
  return keySet.charAt(Math.floor(Math.random() * keySetSize));
}
