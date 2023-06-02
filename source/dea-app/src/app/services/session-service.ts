/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { Paged } from 'dynamodb-onetable';
import { logger } from '../../logger';
import { DeaSession, DeaSessionInput } from '../../models/session';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import * as SessionPersistence from '../../persistence/session';
import { retry } from './service-helpers';

const INACTIVITY_TIMEOUT_IN_MS = 1800000;

export const createSession = async (
  session: DeaSessionInput,
  repositoryProvider: ModelRepositoryProvider
): Promise<DeaSession> => {
  try {
    return await SessionPersistence.createSession(session, repositoryProvider);
  } catch (error) {
    // Its possible for the frontend to make 2 calls simulataneously after login
    // causing a race condition where both calls try to find the sessions
    // see it doesn't exist, and try to create it
    // and one would fail due to uniqueness constraint.
    // Therefore, try to see if session exists, and return that
    const maybeSession = await retry<DeaSession>(async () => {
      const maybeSession = await SessionPersistence.getSession(
        session.userUlid,
        session.tokenId,
        repositoryProvider
      );
      if (!maybeSession) {
        throw new Error('Could not find session...');
      }
      return maybeSession;
    });
    if (!maybeSession) {
      throw new Error(error);
    }

    return maybeSession;
  }
};

export const getSessionsForUser = async (
  userUlid: string,
  repositoryProvider: ModelRepositoryProvider
): Promise<Paged<DeaSession>> => {
  return await SessionPersistence.listSessionsForUser(userUlid, repositoryProvider);
};

// Confirm that the user has a valid session
// and can continue with their API call
// Requirements:
// 1. There are no concurrent active sesssion for the user:
// (we determine this by using the origin_jti on the token)
// 2. If the current session for the user already exisits
// it has not been 30+ minutes since the last updated time
// on the session
// NOTE: This function also creates a session if it does
// not exists, or updates the last updated time if it does
// and it is a valid session.
export const isCurrentSessionValid = async (
  userUlid: string,
  tokenId: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: ModelRepositoryProvider
): Promise<boolean | string> => {
  const sessions = await getSessionsForUser(userUlid, repositoryProvider);

  // First check if the current user session already exists in
  // the database: if so, check there are no other active sessions
  // and that "updated" in last 30 minutes:
  // Otherwise, check there are no other active user sessions
  const currentSessionForUser = sessions.find((session) => session.tokenId === tokenId);
  if (currentSessionForUser) {
    if (currentSessionForUser.isRevoked) {
      return 'The current user session has been revoked, please reauthenticate.';
    }

    if (isSessionExpired(currentSessionForUser)) {
      return 'The current user session is expired, please reauthenticate.';
    }

    if (shouldSessionBeConsideredInactive(currentSessionForUser)) {
      return 'You have been inactive for 30+ minutes, please reauthenticate.';
    }

    await updateLastActiveTimeForSession(currentSessionForUser, repositoryProvider);
    return true;
  } else {
    await createSession(
      {
        userUlid,
        tokenId,
      },
      repositoryProvider
    );
    return true;
  }
};

// Send empty update to DDB to update the "updated" time for
// the session. This resets the clock on the 30+ minutes of
// inactivity for the session lock. E.g. if a user is
// inactive for 30 minutes they have to reauthenticate
export const updateLastActiveTimeForSession = async (
  session: DeaSession,
  repositoryProvider: ModelRepositoryProvider
) => {
  try {
    await SessionPersistence.updateSession(session, repositoryProvider);
  } catch (error) {
    if ('code' in error && error.code === 'TransactionCanceledException') {
      logger.debug(`Session update already in progress, moving on...`);
    } else {
      throw error;
    }
  }
};

// When a user logouts, or a new id token is
// issued from the refresh token, mark previous
// session as revoked so that new session will
// meet session reqs (no concurrent sessions)
export const markSessionAsRevoked = async (
  userUlid: string,
  tokenId: string,
  /* the default case is handled in e2e tests */
  /* istanbul ignore next */
  repositoryProvider: ModelRepositoryProvider
) => {
  const maybeSession = await SessionPersistence.getSession(userUlid, tokenId, repositoryProvider);

  if (!maybeSession) {
    logger.info('No session to revoke for user ' + userUlid);
  } else {
    logger.info('Revoking session for user ' + userUlid + '...');
    try {
      await SessionPersistence.updateSession(
        {
          ...maybeSession,
          isRevoked: true,
        },
        repositoryProvider
      );
    } catch (error) {
      if ('code' in error && error.code === 'TransactionCanceledException') {
        logger.debug(`Revoking session already in progress, moving on...`);
      } else {
        throw error;
      }
    }
  }
};

function isSessionExpired(session: DeaSession): boolean {
  const currentTimeInSeconds = Date.now() / 1000;
  return currentTimeInSeconds > session.ttl;
}

// This function is public ONLY for testing purposes
export const shouldSessionBeConsideredInactive = (session: DeaSession): boolean => {
  if (!session.updated) {
    return true;
  }

  return Date.now() - session.updated.getTime() > INACTIVITY_TIMEOUT_IN_MS;
};
