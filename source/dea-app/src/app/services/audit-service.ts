/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import AuditPlugin from '@aws/workbench-core-audit/lib/auditPlugin';
import AuditService from '@aws/workbench-core-audit/lib/auditService';
import {
  CloudWatchLogsClient,
  GetQueryResultsCommand,
  QueryStatus,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { getRequiredEnv } from '../../lambda-http-helpers';
import { deaAuditPlugin } from '../audit/dea-audit-plugin';

export enum AuditEventResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

export enum AuditEventSource {
  API_GATEWAY = 'APIGateway',
  AWS_CONSOLE = 'AWS Console',
}

export const UNIDENTIFIED_USER = 'UNIDENTIFIED_USER';

export enum AuditEventType {
  CREATE_CASE = 'CreateCase',
  GET_MY_CASES = 'GetMyCases',
  GET_ALL_CASES = 'GetAllCases',
  GET_CASE_DETAILS = 'GetCaseDetails',
  GET_CASE_ACTIONS = 'GetCaseActions',
  UPDATE_CASE_DETAILS = 'UpdateCaseDetails',
  DELETE_CASE = 'DeleteCase',
  GET_USERS_FROM_CASE = 'GetUsersFromCase',
  INVITE_USER_TO_CASE = 'InviteUserToCase',
  REMOVE_USER_FROM_CASE = 'RemoveUserFromCase',
  MODIFY_USER_PERMISSIONS_ON_CASE = 'ModifyUserCasePermissions',
  INITIATE_CASE_FILE_UPLOAD = 'InitiateCaseFileUpload',
  COMPLETE_CASE_FILE_UPLOAD = 'CompleteCaseFileUpload',
  GET_LOGIN_URL = 'GetLoginUrl',
  GET_LOGOUT_URL = 'GetLogoutUrl',
  GET_AUTH_TOKEN = 'GetAuthenticationToken',
  REVOKE_AUTH_TOKEN = 'RevokeAuthToken',
  EXCHANGE_TOKEN_FOR_CREDS = 'ExchangeAuthTokenForCredentials',
  GET_ALL_USERS = 'GetAllUsers',
  DOWNLOAD_CASE_FILE = 'DownloadCaseFile',
  GET_CASE_FILES = 'GetCaseFiles',
  GET_CASE_FILE_DETAIL = 'GetCaseFileDetail',
  GET_CASE_AUDIT = 'GetCaseAudit',
  REQUEST_CASE_AUDIT = 'RequestCaseAudit',
  UNKNOWN = 'UnknownEvent',
}

export enum IdentityType {
  COGNITO_ID = 'CognitoId',
  COGNITO_TOKEN = 'CognitoToken',
  FULL_USER_ID = 'FullUser',
  AUTH_CODE_REQUESTOR = 'AuthCodeRequestor',
  ID_TOKEN_REQUESTOR = 'TokenRequestor',
  UNIDENTIFIED_REQUESTOR = 'UnidentifiedRequestor',
  LOGIN_URL_REQUESTOR = 'LoginUrlRequestor',
  LOGOUT_URL_REQUESTOR = 'LogoutUrlRequestor',
}

// If no identifying information is provided
export type UnidentifiedRequestor = {
  idType: IdentityType.UNIDENTIFIED_REQUESTOR;
  sourceIp: string;
};

// The data in this identifier comes from a user requesting an idtoken by requesting an authCode
export type AuthCodeRequestor = {
  idType: IdentityType.AUTH_CODE_REQUESTOR;
  sourceIp: string;
  authCode: string;
};

// The data in this identifier comes from a user making a credentials exchange, providing an idToken
export type TokenExchangeRequestor = {
  idType: IdentityType.ID_TOKEN_REQUESTOR;
  sourceIp: string;
  idToken: string;
};

// The data in this identifier is guaranteed as soon as we enter our standard IAM gated endpoints
export type CognitoIdentityId = {
  idType: IdentityType.COGNITO_ID;
  sourceIp: string;
  id: string;
};

// The data in this identifier comes from successful retrieval of Cognito token (+ data from the prior progression)
export type CognitoTokenId = {
  idType: IdentityType.COGNITO_TOKEN;
  sourceIp: string;
  id: string;
  username: string;
  deaRole: string;
};

export type LoginUrlId = {
  idType: IdentityType.LOGIN_URL_REQUESTOR;
  sourceIp: string;
};

export type LogoutUrlId = {
  idType: IdentityType.LOGOUT_URL_REQUESTOR;
  sourceIp: string;
};

// The data in this identifier comes from successful creation or retrieval of a DEA user (+ data from the prior progression)
export type FullUserId = {
  idType: IdentityType.FULL_USER_ID;
  sourceIp: string;
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  userUlid: string;
  deaRole: string;
};

// We support different progressions of identifier, anticipating that we may encounter an error along the authentication process
export type ActorIdentity =
  | CognitoIdentityId
  | CognitoTokenId
  | FullUserId
  | AuthCodeRequestor
  | TokenExchangeRequestor
  | LoginUrlId
  | LogoutUrlId
  | UnidentifiedRequestor;

/**
 * The following content shall be included with every audited event:
  1. Date and time of the event.
  2. The component of the information system (e.g., software component, hardware component) where the event occurred.
  3. Type of event.
  4. User/subject identity.
  5. Outcome (success or failure) of the event.
 */
export type CJISAuditEventBody = {
  dateTime: string;
  requestPath: string;
  sourceComponent: AuditEventSource;
  eventType: AuditEventType;
  actorIdentity: ActorIdentity;
  result: AuditEventResult;
  fileHash?: string;
  caseId?: string;
  fileId?: string;
};

const queryFields =
  'dateTime, requestPath, sourceComponent, eventType, actorIdentity.idType, actorIdentity.id, actorIdentity.sourceIp, actorIdentity.username, actorIdentity.firstName, actorIdentity.lastName, actorIdentity.userUlid, actorIdentity.deaRole, actorIdentity.authCode, actorIdentity.idToken, caseId, fileId';

export interface AuditResult {
  status: QueryStatus | string;
  csvFormattedData: string | undefined;
}

const continueOnError = false;
const requiredAuditValues = [
  'dateTime',
  'requestPath',
  'sourceComponent',
  'eventType',
  'actorIdentity',
  'result',
];
const fieldsToMask = ['password', 'accessKey', 'idToken', 'X-Amz-Security-Token'];

export class DeaAuditService extends AuditService {
  constructor(
    auditPlugin: AuditPlugin,
    continueOnError?: boolean,
    requiredAuditValues?: string[],
    fieldsToMask?: string[]
  ) {
    super(auditPlugin, continueOnError, requiredAuditValues, fieldsToMask);
  }

  public async writeCJISCompliantEntry(event: CJISAuditEventBody) {
    return this.write(event);
  }

  public async requestAuditForCase(
    caseId: string,
    start: number,
    end: number,
    cloudwatchClient: CloudWatchLogsClient
  ) {
    const auditLogGroup = getRequiredEnv('AUDIT_LOG_GROUP_NAME');
    const startQueryCmd = new StartQueryCommand({
      logGroupName: auditLogGroup,
      startTime: start,
      endTime: end,
      queryString: `filter caseId like /${caseId}/ | fields ${queryFields} | sort @timestamp desc | limit 10000`,
    });
    const startResponse = await cloudwatchClient.send(startQueryCmd);
    if (!startResponse.queryId) {
      throw new Error('Unknown error starting Cloudwatch Logs Query.');
    }
    return startResponse.queryId;
  }

  public async getAuditResult(queryId: string, cloudwatchClient: CloudWatchLogsClient): Promise<AuditResult> {
    const getResultsCommand = new GetQueryResultsCommand({
      queryId,
    });

    const getResultsResponse = await cloudwatchClient.send(getResultsCommand);

    if (
      getResultsResponse.status === QueryStatus.Complete &&
      getResultsResponse.results &&
      getResultsResponse.results.length > 0
    ) {
      const separator = ', ';
      const newline = '\r\n';
      const results = getResultsResponse.results;
      let csvData = results[0].map((column) => column.field).join(separator) + newline;
      results.forEach((row) => {
        csvData += row.map((column) => column.value).join(separator) + newline;
      });

      return {
        status: QueryStatus.Complete,
        csvFormattedData: csvData,
      };
    } else {
      return {
        status: getResultsResponse.status ?? QueryStatus.Unknown,
        csvFormattedData: undefined,
      };
    }
  }
}

export const auditService = new DeaAuditService(
  deaAuditPlugin,
  continueOnError,
  requiredAuditValues,
  fieldsToMask
);
