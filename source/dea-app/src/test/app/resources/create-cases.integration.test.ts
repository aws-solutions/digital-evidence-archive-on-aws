/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { fail } from "assert";
import Joi from "joi";
import { createCases } from "../../../app/resources/create-cases";
import { DeaCase } from "../../../models/case";
import { caseResponseSchema } from "../../../models/validation/case";
import { ModelRepositoryProvider } from "../../../persistence/schema/entities";
import { dummyContext, dummyEvent } from "../../integration-objects";
import { getTestRepositoryProvider } from "./get-test-repository";

let repositoryProvider: ModelRepositoryProvider;

describe('create cases resource', () => {

    beforeAll(async () => {
        repositoryProvider = await getTestRepositoryProvider('createCasesTest');
    });

    afterAll(async () => {
        await repositoryProvider.table.deleteTable('DeleteTableForever');
    });

    it('should successfully create a case', async () => {
        createAndValidateCase("ANewCase", "A description of the new case");
    });

    it('should fail to create a case when the provided name is already in use', async () => {
        const name = "Case-Test2";
        const description = "A description of the new case";
        const status = 'ACTIVE';
        await createAndValidateCase(name, description);

        const event = Object.assign({}, {
            ...dummyEvent,
            body: JSON.stringify({
                name,
                status,
                description,
            }),
        });
        await expect(createCases(event, dummyContext, repositoryProvider)).rejects.toThrow("Cannot create unique attributes \"name\" for \"Case\". An item of the same name already exists.");
    });

    it('should throw a validation exception when no name is provided', async () => {
        const status = 'ACTIVE';
        const description ="monday tuesday wednesday";

        const event = Object.assign({}, {
            ...dummyEvent,
            body: JSON.stringify({
                status,
                description,
            }),
        });
        await expect(createCases(event, dummyContext, repositoryProvider)).rejects.toThrow(`"name" is required`);
    });

    it('should throw a validation exception when no payload is provided', async () => {
        const event = Object.assign({}, {
            ...dummyEvent,
            body: undefined,
        });
        await expect(createCases(event, dummyContext, repositoryProvider)).rejects.toThrow("Create cases payload missing.");
    });

    it('should enforce a strict payload', async () => {
        const status = 'ACTIVE';
        const name = 'ACaseWithGeneratedUlid';
        const description = 'should ignore provided ulid';
        const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

        const event = Object.assign({}, {
            ...dummyEvent,
            body: JSON.stringify({
                name,
                status,
                description,
                ulid,
            }),
        });
        await expect(createCases(event, dummyContext, repositoryProvider)).rejects.toThrow(`"ulid" is not allowed`);
    });
});

async function createAndValidateCase(name: string, description: string): Promise<void> {
    const status = 'ACTIVE';

    const event = Object.assign({}, {
        ...dummyEvent,
        body: JSON.stringify({
            name,
            status,
            description,
        }),
    });
    const response = await createCases(event, dummyContext, repositoryProvider);

    expect(response.statusCode).toEqual(200);

    if (!response.body) {
        fail();
    }

    const newCase: DeaCase = JSON.parse(response.body);

    Joi.assert(newCase, caseResponseSchema);
    expect(newCase.name).toEqual(name);
    expect(newCase.status).toEqual(status);
    expect(newCase.description).toEqual(description);
}
