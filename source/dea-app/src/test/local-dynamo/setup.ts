/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import DynamoDbLocal from 'dynamo-db-local';
import { Dynamo } from 'dynamodb-onetable/Dynamo';
import waitPort from "wait-port";

const PORT = parseInt(process.env.PORT || '4567');
export const dynamoTestClient = new Dynamo({
    client: new DynamoDBClient({
        endpoint: `http://localhost:${PORT}`,
        region: 'local',
        credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
        },

    })
});

const setup = async (): Promise<void> => {
    const dynamodb = DynamoDbLocal.spawn({ port: PORT })
    await waitPort({
        host: '0.0.0.0',
        port: PORT,
        timeout: 10000,
    });

    process.env.DYNAMODB_PID = String(dynamodb.pid)
    process.env.DYNAMODB_PORT = String(PORT)

    process.on('unhandledRejection', () => {
        if (process.env.DYNAMODB_PID) {
            const pid = parseInt(process.env.DYNAMODB_PID)
            process.kill(pid)
        }
    });
};

export default setup;