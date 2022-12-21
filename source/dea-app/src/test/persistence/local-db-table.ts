/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Table } from "dynamodb-onetable";
import { DeaSchema } from "../../persistence/schema/dea-schema";
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
