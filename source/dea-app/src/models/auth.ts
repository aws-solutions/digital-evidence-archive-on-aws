/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface Oauth2Token {
  readonly id_token: string;
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly token_type: string;
}

export interface RefreshToken {
  readonly refreshToken: string;
}

export interface RevokeToken {
  readonly refreshToken: string;
}

export interface IdToken {
  readonly idToken: string;
}

export interface ExchangeToken {
  readonly codeVerifier: string;
}
