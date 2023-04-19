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
  ResultField,
  StartQueryCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { getRequiredEnv } from '../../lambda-http-helpers';
import { deaAuditPlugin } from '../audit/dea-audit-plugin';

export enum AuditEventResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  SUCCESS_WITH_WARNINGS = 'success with warning',
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
  UPDATE_CASE_STATUS = 'UpdateCaseStatus',
  DELETE_CASE = 'DeleteCase',
  CREATE_CASE_OWNER = 'CreateCaseOwner',
  GET_USERS_FROM_CASE = 'GetUsersFromCase',
  INVITE_USER_TO_CASE = 'InviteUserToCase',
  REMOVE_USER_FROM_CASE = 'RemoveUserFromCase',
  MODIFY_USER_PERMISSIONS_ON_CASE = 'ModifyUserCasePermissions',
  INITIATE_CASE_FILE_UPLOAD = 'InitiateCaseFileUpload',
  COMPLETE_CASE_FILE_UPLOAD = 'CompleteCaseFileUpload',
  GET_LOGIN_URL = 'GetLoginUrl',
  GET_LOGOUT_URL = 'GetLogoutUrl',
  GET_AUTH_TOKEN = 'GetAuthenticationToken',
  REFRESH_AUTH_TOKEN = 'RefreshIdToken',
  REVOKE_AUTH_TOKEN = 'RevokeAuthToken',
  GET_ALL_USERS = 'GetAllUsers',
  DOWNLOAD_CASE_FILE = 'DownloadCaseFile',
  GET_CASE_FILES = 'GetCaseFiles',
  GET_CASE_FILE_DETAIL = 'GetCaseFileDetail',
  GET_CASE_AUDIT = 'GetCaseAudit',
  REQUEST_CASE_AUDIT = 'RequestCaseAudit',
  GET_CASE_FILE_AUDIT = 'GetCaseFileAudit',
  REQUEST_CASE_FILE_AUDIT = 'RequestCaseFileAudit',
  GET_AVAILABLE_ENDPOINTS = 'GetAvailableEndpoints',
  GET_SCOPED_CASE_INFO = 'GetScopedCaseInformation',
  GET_USER_AUDIT = 'GetUserAudit',
  REQUEST_USER_AUDIT = 'RequestUserAudit',
  GET_SYSTEM_AUDIT = 'GetSystemAudit',
  REQUEST_SYSTEM_AUDIT = 'RequestSystemAudit',
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
  idPoolUserId: string;
};

// The data in this identifier comes from successful retrieval of Cognito token (+ data from the prior progression)
export type CognitoTokenId = {
  idType: IdentityType.COGNITO_TOKEN;
  sourceIp: string;
  idPoolUserId: string;
  username: string;
  deaRole: string;
  userPoolUserId: string;
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
  idPoolUserId: string; // unique id given to federated user by the Cognito Identity Pool
  username: string;
  firstName: string;
  lastName: string;
  userUlid: string; // unique id for user granted and used by DEA system. Stored in DDB and used for CaseUser
  deaRole: string;
  userPoolUserId: string; // unique id given to federated user by the Cognito User Pool. Stored in DDB and used to determine whether user is in DB already or not
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
  targetUserId?: string;
};

/**
 * CloudWatch fields to show in query results.
 * To combine values from multiple source properties we use coalesce function.
 * coalesce: Returns the first non-null value from the list.
 */
const queryFields = [
  'coalesce(dateTime, eventTime) as eventDateTime',
  'eventType',
  'coalesce(requestPath, eventName) as eventDetails',
  'coalesce(sourceComponent, eventSource) as source',
  'coalesce(sourceIPAddress, actorIdentity.sourceIp) as sourceIp',
  'coalesce(actorIdentity.idType, userIdentity.type) as userType',
  'coalesce(actorIdentity.username, userIdentity.userName) as username',
  'actorIdentity.deaRole',
  'actorIdentity.userUlid',
  'actorIdentity.firstName',
  'actorIdentity.lastName',
  'actorIdentity.idPoolUserId',
  'actorIdentity.userPoolUserId',
  'actorIdentity.authCode',
  'actorIdentity.idToken',
  'caseId',
  'fileId',
  'fileHash',
  'targetUserId',
];

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

  private async _startAuditQuery(
    start: number,
    end: number,
    cloudwatchClient: CloudWatchLogsClient,
    logGroupNames: string[],
    filterPredicate?: string
  ) {
    const defaultQuery = `fields ${queryFields.join(', ')} | sort @timestamp desc | limit 10000`;
    const startQueryCmd = new StartQueryCommand({
      logGroupNames,
      startTime: start,
      endTime: end,
      queryString: filterPredicate ? `filter ${filterPredicate} | ${defaultQuery}` : defaultQuery,
    });
    const startResponse = await cloudwatchClient.send(startQueryCmd);
    if (!startResponse.queryId) {
      throw new Error('Unknown error starting Cloudwatch Logs Query.');
    }
    return startResponse.queryId;
  }

  public async requestAuditForCase(
    caseId: string,
    start: number,
    end: number,
    cloudwatchClient: CloudWatchLogsClient
  ) {
    const auditLogGroups = [getRequiredEnv('AUDIT_LOG_GROUP_NAME')];
    const filterPredicate = `caseId like /${caseId}/`;
    return this._startAuditQuery(start, end, cloudwatchClient, auditLogGroups, filterPredicate);
  }

  public async requestAuditForCaseFile(
    caseId: string,
    fileId: string,
    start: number,
    end: number,
    cloudwatchClient: CloudWatchLogsClient
  ) {
    const auditLogGroups = [getRequiredEnv('AUDIT_LOG_GROUP_NAME')];
    const filterPredicate = `caseId like /${caseId}/ and fileId like /${fileId}/`;
    return this._startAuditQuery(start, end, cloudwatchClient, auditLogGroups, filterPredicate);
  }

  public async requestAuditForUser(
    userUlid: string,
    start: number,
    end: number,
    cloudwatchClient: CloudWatchLogsClient
  ) {
    const auditLogGroups = [getRequiredEnv('AUDIT_LOG_GROUP_NAME')];
    const filterPredicate = `actorIdentity.userUlid = '${userUlid}'`;
    return this._startAuditQuery(start, end, cloudwatchClient, auditLogGroups, filterPredicate);
  }

  public async requestSystemAudit(start: number, end: number, cloudwatchClient: CloudWatchLogsClient) {
    const systemLogGroups = [getRequiredEnv('AUDIT_LOG_GROUP_NAME'), getRequiredEnv('TRAIL_LOG_GROUP_NAME')];
    return this._startAuditQuery(start, end, cloudwatchClient, systemLogGroups);
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
      return {
        status: QueryStatus.Complete,
        csvFormattedData: this._formatResults(getResultsResponse.results),
      };
    } else {
      return {
        status: getResultsResponse.status ?? QueryStatus.Unknown,
        csvFormattedData: undefined,
      };
    }
  }

  private _formatResults(results: ResultField[][]): string {
    const separator = ', ';
    const newline = '\r\n';
    let csvData = '';
    let csvHeaders = '';
    results.forEach((row) => {
      // Excluding @ptr field from the csv output.
      // Only the fields requested in the query are returned, along with a @ptr field, which is the identifier for the log record.
      const csvFields = row.filter((column) => column.field !== '@ptr');
      csvData += csvFields.map((column) => column.value).join(separator) + newline;
      // csv headers come from the row with more fields.
      // All the rows not necessarily have the same amount of fields, only fields with values are returned for each row.
      const rowHeader = csvFields.map((column) => column.field).join(separator) + newline;
      if (csvHeaders.length < rowHeader.length) {
        csvHeaders = rowHeader;
      }
    });
    const csvContent = csvHeaders + csvData;
    return csvContent;
  }
}

export const auditService = new DeaAuditService(
  deaAuditPlugin,
  continueOnError,
  requiredAuditValues,
  fieldsToMask
);
