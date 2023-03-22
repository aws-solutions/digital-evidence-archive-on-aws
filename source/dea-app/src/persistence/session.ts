/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Paged } from 'dynamodb-onetable';
import { sessionFromEntity } from '../models/projections';
import { DeaSession, DeaSessionInput } from '../models/session';
import { isDefined } from './persistence-helpers';
import { SessionModel, SessionModelRepositoryProvider } from './schema/entities';

export const listSessionsForUser = async (
  userUlid: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: SessionModelRepositoryProvider = {
    SessionModel: SessionModel,
  }
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
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: SessionModelRepositoryProvider = {
    SessionModel: SessionModel,
  }
): Promise<DeaSession> => {
  const newEntity = await repositoryProvider.SessionModel.create({
    ...deaSession,
    isRevoked: false,
  });

  return sessionFromEntity(newEntity);
};

export const updateSession = async (
  deaSession: DeaSession,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: SessionModelRepositoryProvider = {
    SessionModel: SessionModel,
  }
): Promise<DeaSession> => {
  const newEntity = await repositoryProvider.SessionModel.update({
    ...deaSession,
  });

  return sessionFromEntity(newEntity);
};
