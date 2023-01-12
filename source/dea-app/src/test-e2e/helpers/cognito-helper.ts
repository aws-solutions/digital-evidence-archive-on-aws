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
  AuthFlowType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { Credentials } from 'aws4-axios';
import Setup from './setup';

export default class CognitoHelper {
  private _identityPoolClient: CognitoIdentityClient;
  private _userPoolProvider: CognitoIdentityProviderClient;
  private _region: string;
  private _userPoolClientId: string;
  private _userPoolId: string;
  private _identityPoolId: string;
  private _idpUrl: string;

  private _usersCreated: string[] = [];

  public constructor(setup: Setup) {
    const settings = setup.getSettings();
    this._region = settings.get('awsRegion');
    this._userPoolId = settings.get('userPoolId');
    this._userPoolClientId = settings.get('clientId');
    this._identityPoolId = settings.get('identityPoolId');

    this._idpUrl = `cognito-idp.${this._region}.amazonaws.com/${this._userPoolId}`;

    this._identityPoolClient = new CognitoIdentityClient({ region: this._region });
    this._userPoolProvider = new CognitoIdentityProviderClient({ region: this._region });
  }

  public async createUser(userName: string, groupName: string): Promise<void> {
    // 1. Create User
    try {
      const user = await this._userPoolProvider.send(
        new AdminCreateUserCommand({
          UserPoolId: this._userPoolId,
          MessageAction: MessageActionType.SUPPRESS,
          Username: userName,
          TemporaryPassword: '*TempPass1234*',
        })
      );
      if (user.User?.Username) {
        this._usersCreated.push(user.User.Username);

        // 2. Change Password
        const command = new AdminSetUserPasswordCommand({
          Password: '&TestPassword!1234',
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

  public async getCredentialsForUser(userName: string): Promise<Credentials> {
    // 1. Authenticate with User Pool, get Token
    const result = await this._userPoolProvider.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: userName,
          PASSWORD: '&TestPassword!1234',
        },
        ClientId: this._userPoolClientId,
      })
    );

    // 2. Get Identity from Identity Pool
    const identityId = await this._identityPoolClient.send(
      new GetIdCommand({
        IdentityPoolId: this._identityPoolId,
        Logins: {
          [this._idpUrl]: result.AuthenticationResult?.IdToken ?? 'INVALIDTOKEN',
        },
      })
    );

    // 3. Get Credentials from the Identity Pool
    const response = await this._identityPoolClient.send(
      new GetCredentialsForIdentityCommand({
        IdentityId: identityId.IdentityId,
        Logins: {
          [this._idpUrl]: result.AuthenticationResult?.IdToken ?? 'INVALIDTOKEN',
        },
      })
    );

    if (!response.Credentials) {
      throw new Error('Failed to get credentials from the identity pool: ' + response);
    }
    const creds = response.Credentials;
    if (creds.AccessKeyId && creds.SecretKey && creds.SessionToken) {
      return {
        accessKeyId: creds.AccessKeyId,
        secretAccessKey: creds.SecretKey,
        sessionToken: creds.SessionToken,
      };
    } else {
      throw new Error('Failed to get credentials from the identity pool: ' + creds);
    }
  }

  public async cleanup(): Promise<void> {
    // Clean the users made
    await Promise.all(
      this._usersCreated.map(async (username) => {
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