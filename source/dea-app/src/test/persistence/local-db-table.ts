/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Table } from "dynamodb-onetable";
import { DeaSchema } from "../../persistence/schema/dea-schema";
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { dynamoTestClient } from "../local-dynamo/setup";


export const initLocalDb = async (tableName: string): Promise<Table> => {

    const testTable = new Table({
        client: dynamoTestClient,
        name: tableName,
        schema: DeaSchema,
        partial: false,
    });

    await testTable.createTable();

    return testTable;
}

export const getTestRepositoryProvider = (testTable: Table): ModelRepositoryProvider => {
    return {
        table: testTable,
        CaseModel: testTable.getModel('Case'),
        CaseUserModel: testTable.getModel('CaseUser'),
        CaseFileModel: testTable.getModel('CaseFile'),
        UserModel: testTable.getModel('User'),
    }
}
