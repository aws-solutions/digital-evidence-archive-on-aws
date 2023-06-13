/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  CognitoIdentityClient,
  GetCredentialsForIdentityCommand,
  GetIdCommand,
} from '@aws-sdk/client-cognito-identity';
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminGetUserResponse,
  AdminSetUserPasswordCommand,
  AuthenticationResultType,
  AuthFlowType,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  MessageActionType,
} from '@aws-sdk/client-cognito-identity-provider';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Credentials } from 'aws4-axios';
import { getTokenPayload } from '../../cognito-token-helpers';
import { Oauth2Token } from '../../models/auth';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { deleteUser, getUserByTokenId } from '../../persistence/user';
import { testEnv } from './settings';

export default class CognitoHelper {
  private identityPoolClient: CognitoIdentityClient;
  private userPoolProvider: CognitoIdentityProviderClient;
  private region: string;
  // region and cognitoRegion are only different in us-gov-east-1, since Cognito is unavailable
  private cognitoRegion: string;
  readonly userPoolClientId: string;
  readonly userPoolId: string;
  private identityPoolId: string;
  readonly idpUrl: string;

  private usersCreated: string[] = [];
  public testPassword: string;
  private stage: string;

  public constructor(globalPassword?: string) {
    // If regionis us gov east, the cognito stack is in us-gov-west due to cognito inavailability
    this.region = testEnv.awsRegion;
    this.cognitoRegion = this.region === 'us-gov-east-1' ? 'us-gov-west-1' : testEnv.awsRegion;
    this.userPoolId = testEnv.userPoolId;
    this.userPoolClientId = testEnv.clientId;
    this.identityPoolId = testEnv.identityPoolId;
    this.stage = testEnv.stage;

    this.idpUrl = `cognito-idp.${this.cognitoRegion}.amazonaws.com/${this.userPoolId}`;

    this.identityPoolClient = new CognitoIdentityClient({ region: this.cognitoRegion });
    this.userPoolProvider = new CognitoIdentityProviderClient({ region: this.cognitoRegion });

    this.testPassword = globalPassword ?? generatePassword();
  }

  public async createUser(
    userName: string,
    deaRole: string,
    firstName: string,
    lastName: string
  ): Promise<void> {
    // 1. Create User
    try {
      const user = await this.userPoolProvider.send(
        new AdminCreateUserCommand({
          UserPoolId: this.userPoolId,
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
            {
              Name: 'custom:DEARole',
              Value: deaRole,
            },
          ],
        })
      );
      if (user.User?.Username) {
        this.usersCreated.push(user.User.Username);

        // 2. Change Password
        const command = new AdminSetUserPasswordCommand({
          Password: this.testPassword,
          Permanent: true,
          Username: userName,
          UserPoolId: this.userPoolId,
        });
        await this.userPoolProvider.send(command);
      } else {
        throw new Error('Failed to create user with username: ' + user);
      }
    } catch (error) {
      console.log('Failed to create user ' + error);
      return;
    }
  }

  public async getUser(userName: string): Promise<AdminGetUserResponse | undefined> {
    try {
      return await this.userPoolProvider.send(
        new AdminGetUserCommand({
          Username: userName,
          UserPoolId: this.userPoolId,
        })
      );
    } catch (error) {
      console.log('Could not find user ' + error);
      return;
    }
  }

  public async doesUserExist(userName: string): Promise<boolean> {
    return (await this.getUser(userName)) ? true : false;
  }

  getClientSecret = async () => {
    const clientSecretId = `/dea/${this.stage}/clientSecret`;

    const client = new SecretsManagerClient({ region: this.region });
    const input = {
      SecretId: clientSecretId,
    };
    const command = new GetSecretValueCommand(input);
    const secretResponse = await client.send(command);

    if (secretResponse.SecretString) {
      return secretResponse.SecretString;
    } else {
      throw new Error(`Cognito secret ${clientSecretId} not found!`);
    }
  };

  private async getUserPoolAuthForUser(userName: string): Promise<AuthenticationResultType> {
    const clientSecret = await this.getClientSecret();
    const secretHash = this.generateSecretHash(this.userPoolClientId, clientSecret, userName);

    const result = await this.userPoolProvider.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: userName,
          PASSWORD: this.testPassword,
          SECRET_HASH: secretHash,
        },
        ClientId: this.userPoolClientId,
      })
    );

    if (!result.AuthenticationResult) {
      throw new Error('Unable to authenticate with the user pool.');
    }

    return result.AuthenticationResult;
  }

  private generateSecretHash(clientId: string, clientSecret: string, userName: string): string {
    const secretHash = crypto
      .createHmac('SHA256', clientSecret)
      .update(userName + clientId)
      .digest('base64');

    return secretHash;
  }

  public async getIdTokenForUser(userName: string): Promise<Oauth2Token> {
    const result = await this.getUserPoolAuthForUser(userName);

    if (!result.IdToken || !result.RefreshToken) {
      throw new Error('Unable to get id token and refresh token from user pool.');
    }

    return {
      id_token: result.IdToken,
      refresh_token: result.RefreshToken,
      expires_in: result.ExpiresIn ?? 4000,
    };
  }

  public async getCredentialsForUser(userName: string): Promise<[Credentials, Oauth2Token]> {
    // 1. Authenticate with User Pool, get Token
    const oauthToken = await this.getIdTokenForUser(userName);

    // 2. Get Identity from Identity Pool
    const identityId = await this.identityPoolClient.send(
      new GetIdCommand({
        IdentityPoolId: this.identityPoolId,
        Logins: {
          [this.idpUrl]: oauthToken.id_token,
        },
      })
    );

    // 3. Get Credentials from the Identity Pool
    const response = await this.identityPoolClient.send(
      new GetCredentialsForIdentityCommand({
        IdentityId: identityId.IdentityId,
        Logins: {
          [this.idpUrl]: oauthToken.id_token,
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
        oauthToken,
      ];
    } else {
      throw new Error('Failed to get credentials from the identity pool:');
    }
  }

  public async cleanup(repositoryProvider?: ModelRepositoryProvider): Promise<void> {
    // Clean the users made
    await Promise.all(
      this.usersCreated.map(async (username) => {
        // try to remove the user from the db
        // NOTE: it won't be there unless you called
        // lambda using creds from the the user
        const { id_token } = await this.getIdTokenForUser(username);
        const tokenId = (await getTokenPayload(id_token, this.region)).sub;
        if (repositoryProvider) {
          const dbUser = await getUserByTokenId(tokenId, repositoryProvider);
          if (dbUser) {
            await deleteUser(dbUser.ulid ?? fail(), repositoryProvider);
          }
        }

        // Now delete the user from the user pool
        await this.userPoolProvider.send(
          new AdminDeleteUserCommand({
            Username: username,
            UserPoolId: this.userPoolId,
          })
        );
      })
    );

    this.usersCreated = []; // This way if the cleanup() method is called again, we don't need to cleanup again

    if (this.identityPoolClient) {
      this.identityPoolClient.destroy();
    }

    if (this.userPoolProvider) {
      this.userPoolProvider.destroy();
    }
  }

  public async deleteUser(username: string): Promise<void> {
    await this.userPoolProvider.send(
      new AdminDeleteUserCommand({
        Username: username,
        UserPoolId: this.userPoolId,
      })
    );
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
