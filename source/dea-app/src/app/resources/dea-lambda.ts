/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';
import { ModelRepositoryProvider } from '../../persistence/schema/entities';
import { defaultProvider } from '../../persistence/schema/entities';

/*
* Base class for implementing DEA services as lambdas
* Will continue code that all DEA lambdas must share
* such as verifying the session meets the requirements
* and adding users to the DB when federated for the first time
*/

export type DEAGatewayProxyHandler = (
  event: APIGatewayProxyEventV2,
  context: Context,
  repositoryProvider?: ModelRepositoryProvider,
) => Promise<APIGatewayProxyStructuredResultV2>;

export type LambdaEvent = APIGatewayProxyEventV2;
export type LambdaContext = Context;
export type LambdaResult = APIGatewayProxyStructuredResultV2;

export abstract class DEALambda {

    private async runPreExecutionChecks() {
        // TODO: add first time federated users to the database

        // TODO: verify the session management requirements here
        // E.g. no concurrent sessions and session lock after 30 minutes
        // of inactivity
    }

    abstract execute(event: LambdaEvent, context: LambdaContext, repositoryProvider: ModelRepositoryProvider) : Promise<LambdaResult>;

    public handle(event: LambdaEvent, context: LambdaContext, repositoryProvider = defaultProvider): Promise<LambdaResult> {
        // Run the execution checks, if they fail they will throw an error
        this.runPreExecutionChecks();

        // Checks have passed, call the executor
        return this.execute(event, context, repositoryProvider);
    }
}