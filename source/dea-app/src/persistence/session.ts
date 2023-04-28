/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { sessionFromEntity } from '../models/projections';
import { DeaSession, DeaSessionInput } from '../models/session';
import { isDefined } from './persistence-helpers';
import { SessionModelRepositoryProvider } from './schema/entities';

export const listSessionsForUser = async (
  userUlid: string,
  repositoryProvider: SessionModelRepositoryProvider
): Promise<Paged<DeaSession>> => {
  const sessionEntities = await repositoryProvider.SessionModel.find({
    PK: `USER#${userUlid}#`,
    SK: {
      begins_with: 'SESSION#',
    },
  });

  const sessions: Paged<DeaSession> = sessionEntities
    .map((entity) => sessionFromEntity(entity))
    .filter(isDefined);
  sessions.count = sessionEntities.count;
  sessions.next = sessionEntities.next;
  //undefined because I have a concern about travelling backwards to negative page numbers (due to new records)
  sessions.prev = undefined;

  return sessions;
};

export const createSession = async (
  deaSession: DeaSessionInput,
  repositoryProvider: SessionModelRepositoryProvider
): Promise<DeaSession> => {
  const newEntity = await repositoryProvider.SessionModel.create({
    ...deaSession,
    isRevoked: false,
  });

  return sessionFromEntity(newEntity);
};

export const updateSession = async (
  deaSession: DeaSession,
  repositoryProvider: SessionModelRepositoryProvider
): Promise<DeaSession> => {
  const newEntity = await repositoryProvider.SessionModel.update(
    {
      ...deaSession,
    },
    {
      // Normally, update() will return the updated item automatically,
      //   however, it the item has unique attributes,
      //   a transaction is used which does not return the updated item.
      //   In this case, use {return: 'get'} to retrieve and return the updated item.
      return: 'get',
    }
  );

  return sessionFromEntity(newEntity);
};

export const getSession = async (
  userUlid: string,
  tokenId: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: SessionModelRepositoryProvider
): Promise<DeaSession | undefined> => {
  const sessionEntity = await repositoryProvider.SessionModel.get({
    PK: `USER#${userUlid}#`,
    SK: `SESSION#${tokenId}#`,
  });

  if (!sessionEntity) {
    return undefined;
  }

  return sessionFromEntity(sessionEntity);
};
