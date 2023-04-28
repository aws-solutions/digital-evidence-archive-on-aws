/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export interface IUser {
  username: string;
}

export const unknownUser: IUser = {
  username: 'User Name',
};
