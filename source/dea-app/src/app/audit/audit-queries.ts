/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { CaseFileAuditParameters, DataVaultFileAuditParameters } from '../services/audit-service';

/**
 * CloudWatch fields to show in query results.
 * To combine values from multiple source properties we use coalesce function.
 * coalesce: Returns the first non-null value from the list.
 */
const queryFields =
  'COALESCE(dateTime, eventTime) AS DateTimeUTC,' +
  "COALESCE(eventType, '') AS Event_Type," +
  "COALESCE(result, '') AS Result," +
  'COALESCE(requestPath, eventName) AS Request_Path,' +
  'COALESCE(sourceComponent, eventSource) AS Source_Component,' +
  'COALESCE(sourceIPAddress, actorIdentity.sourceIp) AS Source_IP_Address,' +
  'COALESCE(actorIdentity.idType, userIdentity.type) AS Identity_ID_Type,' +
  'COALESCE(actorIdentity.username, userIdentity.userName, userIdentity.sessionContext.sessionIssuer.userName) as Username,' +
  "COALESCE(actorIdentity.deaRole, '') AS Role," +
  "COALESCE(actorIdentity.userUlid, '') AS DEA_User_ID," +
  "COALESCE(actorIdentity.firstName, '') AS First_Name," +
  "COALESCE(actorIdentity.lastName, '') AS Last_Name," +
  "COALESCE(actorIdentity.idPoolUserId, '') AS Identity_Pool_User_ID," +
  "COALESCE(actorIdentity.authCode, '') AS Auth_Code," +
  "COALESCE(actorIdentity.idToken, '') AS ID_Token," +
  "COALESCE(caseId, '') AS Case_ID," +
  "COALESCE(fileId, '') AS File_ID," +
  "COALESCE(dataVaultId, '') AS DataVault_ID," +
  "COALESCE(fileHash, '') AS File_SHA_256," +
  "COALESCE(targetUserId, '') AS Target_User_ID," +
  "COALESCE(caseActions, '') AS Case_Actions," +
  "COALESCE(eventID, '') AS eventID";

// sort by DateTimeUTC, the time when the event actually occurred, rather than timestamp, the moment when it appeared in logs
const orderByClause = 'ORDER BY from_iso8601_timestamp(DateTimeUTC) ASC';

export const getAuditQueryString = (
  AUDIT_GLUE_DATABASE: string,
  AUDIT_GLUE_TABLE: string,
  whereClauses: string[] | undefined,
  start: number,
  end: number
) => {
  const timeClause = `from_iso8601_timestamp(COALESCE(dateTime, eventTime)) between from_unixtime(${start}) and from_unixtime(${end})`;
  let queryString = `SELECT ${queryFields} FROM "${AUDIT_GLUE_DATABASE}"."${AUDIT_GLUE_TABLE}" where ${timeClause} ${orderByClause};`;
  if (whereClauses) {
    queryString = whereClauses
      .map(
        (whereClause) =>
          `SELECT ${queryFields} FROM "${AUDIT_GLUE_DATABASE}"."${AUDIT_GLUE_TABLE}" ${whereClause} and ${timeClause}`
      )
      .join(' UNION ALL ');
    queryString += ` ${orderByClause};`;
  }
  return queryString;
};

export const getCaseWhereClauses = (caseId: string) => [
  `where caseId LIKE '${caseId}'`,
  `where eventsource = 'dynamodb.amazonaws.com' and (requestParameters.key.PK LIKE 'CASE#${caseId}#' or requestParameters.key.GSI1PK LIKE 'CASE#${caseId}#%' or requestParameters.key.GSI2PK LIKE 'CASE#${caseId}#%' or any_match(requestparameters.requestItems, element -> element.key.PK like '%${caseId}%' or element.key.GSI1PK like '%${caseId}%' or element.key.GSI2PK like '%${caseId}%'))`,
];

export const getCaseFileWhereClauses = (caseFileParameters: CaseFileAuditParameters) => {
  const primaryIndexCondition = `requestParameters.key.PK LIKE 'CASE#${caseFileParameters.caseId}#' and requestParameters.key.SK LIKE 'FILE#${caseFileParameters.fileId}#'`;
  const requestItemsCondition = `element.key.PK LIKE 'CASE#${caseFileParameters.caseId}#' and element.key.SK LIKE 'FILE#${caseFileParameters.fileId}#'`;
  const gsi1Condition = `requestParameters.key.GSI1PK LIKE 'CASE#${caseFileParameters.caseId}#${caseFileParameters.filePath}#' and requestParameters.key.GSI1SK LIKE 'FILE#${caseFileParameters.fileName}#'`;
  const gsi2Condition = `requestParameters.key.GSI2PK LIKE 'CASE#${caseFileParameters.caseId}#${caseFileParameters.filePath}${caseFileParameters.fileName}#'`;

  // These where clauses are separated into different queries because our schema is inconsistent which can cause Athena queries to break
  return [
    `where caseId = '${caseFileParameters.caseId}' and fileId = '${caseFileParameters.fileId}'`,
    `where eventsource = 'dynamodb.amazonaws.com' and ((${primaryIndexCondition}) or (${gsi1Condition}) or (${gsi2Condition}) or any_match(requestparameters.requestItems, element -> ${requestItemsCondition}))`,
    `where eventsource = 's3.amazonaws.com' and resources."0".ARN like '%${caseFileParameters.s3Key}'`,
  ];
};

export const getDataVaultFileWhereClauses = (dataVaultFileParameters: DataVaultFileAuditParameters) => {
  const primaryIndexCondition = `requestParameters.key.PK LIKE 'DATAVAULT#${dataVaultFileParameters.dataVaultId}#' and requestParameters.key.SK LIKE 'FILE#${dataVaultFileParameters.fileId}#'`;
  const requestItemsCondition = `element.key.PK LIKE 'DATAVAULT#${dataVaultFileParameters.dataVaultId}#' and element.key.SK LIKE 'FILE#${dataVaultFileParameters.fileId}#'`;
  const gsi1Condition = `requestParameters.key.GSI1PK LIKE 'DATAVAULT#${dataVaultFileParameters.dataVaultId}#${dataVaultFileParameters.filePath}#' and requestParameters.key.GSI1SK LIKE 'FILE#${dataVaultFileParameters.fileName}#'`;
  const gsi2Condition = `requestParameters.key.GSI2PK LIKE 'DATAVAULT#${dataVaultFileParameters.dataVaultId}#${dataVaultFileParameters.filePath}${dataVaultFileParameters.fileName}#'`;

  // These where clauses are separated into different queries because our schema is inconsistent which can cause Athena queries to break
  return [
    `where dataVaultId = '${dataVaultFileParameters.dataVaultId}' and fileId LIKE '${dataVaultFileParameters.fileId}'`,
    `where eventsource = 'dynamodb.amazonaws.com' and ((${primaryIndexCondition}) or (${gsi1Condition}) or (${gsi2Condition}) or any_match(requestparameters.requestItems, element -> ${requestItemsCondition}))`,
    `where eventsource = 's3.amazonaws.com' and resources."0".ARN like '%${dataVaultFileParameters.s3Key}'`,
  ];
};

export const getDataVaultWhereClauses = (dataVaultId: string) => [
  `where dataVaultId = '${dataVaultId}'`,
  `where eventsource = 'dynamodb.amazonaws.com' and (requestParameters.key.PK LIKE 'DATAVAULT#${dataVaultId}#' or requestParameters.key.GSI1PK LIKE 'DATAVAULT#${dataVaultId}#%' or requestParameters.key.GSI2PK LIKE 'DATAVAULT#${dataVaultId}#%' or any_match(requestparameters.requestItems, element -> element.key.PK like '%${dataVaultId}%' or element.key.GSI1PK like '%${dataVaultId}%' or element.key.GSI2PK like '%${dataVaultId}%'))`,
];

export const getUserWhereClauses = (userUlid: string) => [`where actorIdentity.userUlid = '${userUlid}'`];
