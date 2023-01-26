/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import * as CreateCaseUserHandler from "../../handlers/create-case-user-handler";
import * as CreateCasesHandler from "../../handlers/create-cases-handler";
import * as DeleteCasesHandler from "../../handlers/delete-case-handler";
import * as GetAllCasesHandler from "../../handlers/get-all-cases-handler";
import * as GetCaseDetailHandler from "../../handlers/get-case-detail-handler";
import * as GetMyCasesHandler from "../../handlers/get-my-cases-handler";
import * as SayByeHandler from "../../handlers/say-bye-handler";
import * as SayHelloHandler from "../../handlers/say-hello-handler";
import * as UpdateCasesHandler from "../../handlers/update-cases-handler";

describe('lambda handlers', () => {

    it('should be wrapped with the deaHandler', () => {
        const handlers = [
            CreateCasesHandler.handler,
            CreateCaseUserHandler.handler,
            DeleteCasesHandler.handler,
            GetAllCasesHandler.handler,
            GetCaseDetailHandler.handler,
            GetMyCasesHandler.handler,
            UpdateCasesHandler.handler,
            SayByeHandler.handler,
            SayHelloHandler.handler,
        ];

        handlers.forEach( handler => {
            expect(typeof handler === 'function').toBeTruthy();
        });
    });
});