/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

// import { fail } from "assert";
// import { aws4Interceptor } from "aws4-axios";
// import axios from "axios";
// import Joi from 'joi';
// import { DeaCase } from '../../models/case';
// import { caseSchema } from '../../models/validation/case';
// import CognitoHelper from "../helpers/cognito-helper";
// import Setup from "../helpers/setup";
// import { deleteCase } from './test-helpers';

describe('create cases api', () => {
  it('EMPTY TEST CASE PLACEHOLDER', async () => {
    /* do nothing */
  });
  //   const setup: Setup = new Setup();
  //   const cognitoHelper: CognitoHelper = new CognitoHelper(setup);

  //   const testUser = 'createCaseTestUser';
  //   const deaApiUrl = setup.getSettings().get('apiUrlOutput');
  //   const region = setup.getSettings().get('awsRegion');

  //   beforeAll(async () => {
  //    // Create user in test group
  //    await cognitoHelper.createUser(testUser, 'CreateCasesTestGroup');
  //   });

  //   afterAll(async () => {
  //     await cognitoHelper.cleanup();
  //   });

  //   it('should create a new case', async () => {
  //     const creds = (await cognitoHelper.getCredentialsForUser(testUser));
  //     const client = axios.create();

  //     const interceptor = aws4Interceptor({
  //         service: "execute-api",
  //         region: region,
  //     }, creds);

  //     client.interceptors.request.use(interceptor);

  //     const caseName = 'CASE B';
  //     const url = `${deaApiUrl}cases`;

  //     try {
  //       const response = await client.post(url, {
  //         name: caseName,
  //         status: 'ACTIVE',
  //         description: 'this is a description',
  //       });

  //       console.log("REPONSE");
  //       console.log(response);

  //       expect(response.status).toBeTruthy();

  //       //eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //       const jsonResp = (await response.data) as DeaCase;
  //       Joi.assert(jsonResp, caseSchema);

  //       expect(jsonResp.name).toEqual(caseName);
  //       await deleteCase(deaApiUrl ?? fail(), jsonResp.ulid ?? fail(), creds, region);
  //     } catch (error) {
  //       console.log(error.response);
  //       fail();
  //     }
  //     // const response = await client.post(url, {
  //     //   name: caseName,
  //     //   status: 'ACTIVE',
  //     //   description: 'this is a description',
  //     // });

  //     // expect(response.status).toBeTruthy();

  //     // //eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //     // const jsonResp = (await response.data) as DeaCase;
  //     // Joi.assert(jsonResp, caseSchema);

  //     // expect(jsonResp.name).toEqual(caseName);
  //     // await deleteCase(deaApiUrl ?? fail(), jsonResp.ulid ?? fail(), creds, region);
  //   }, 10000);

  //   // TODO: refactor this test
  //   // it('should give an error when payload is missing', async () => {
  //   //   const creds = (await cognitoHelper.getCredentialsForUser(testUser));
  //   //   const client = axios.create();

  //   //   const interceptor = aws4Interceptor({
  //   //       service: "execute-api",
  //   //       region: region,
  //   //   }, creds);

  //   //   client.interceptors.request.use(interceptor);

  //   //   const response = await client.post(`${deaApiUrl}cases`);
  //   //   console.log(response);

  //   //   // const response = await fetch(`${deaApiUrl}cases`, {
  //   //   //   method: 'POST',
  //   //   //   headers: {
  //   //   //     'content-type': 'application/json;charset=UTF-8',
  //   //   //     authorization: 'allow',
  //   //   //   },
  //   //   //   body: undefined,
  //   //   // });

  //   //   expect(response.status).toBeFalsy();
  //   //   expect(response.status).toEqual(400);
  //   //   expect(await response.data()).toEqual('Create cases payload missing.');
  //   // });

  //   // it('should give an error when the name is in use', async () => {
  //   //   const creds = (await cognitoHelper.getCredentialsForUser(testUser));
  //   //   const client = axios.create();

  //   //   const interceptor = aws4Interceptor({
  //   //       service: "execute-api",
  //   //       region: region,
  //   //   }, creds);

  //   //   client.interceptors.request.use(interceptor);

  //   //   const caseName = 'CASE C';
  //   //   const response = await client.post(`${deaApiUrl}cases`, {
  //   //     name: caseName,
  //   //     status: 'ACTIVE',
  //   //     description: 'any description',
  //   //   });

  //   //   // const response = await fetch(`${deaApiUrl}cases`, {
  //   //   //   method: 'POST',
  //   //   //   headers: {
  //   //   //     'content-type': 'application/json;charset=UTF-8',
  //   //   //     authorization: 'allow',
  //   //   //   },
  //   //   //   body: JSON.stringify({
  //   //   //     name: caseName,
  //   //   //     status: 'ACTIVE',
  //   //   //     description: 'any description',
  //   //   //   }),
  //   //   // });

  //   //   // , {headers: {
  //   //   //   'content-type': 'application/json;charset=UTF-8'
  //   //   // }}

  //   //   expect(response.status).toBeTruthy();
  //   //   // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //   //   const jsonResp = (await response.data) as DeaCase;
  //   //   Joi.assert(jsonResp, caseSchema);

  //   //   const response2 = await client.post('${deaApiUrl}cases', {
  //   //     name: caseName,
  //   //     status: 'ACTIVE',
  //   //     description: 'any description',
  //   //   });

  //   //   expect(response2.status).toBeFalsy();
  //   //   expect(response2.status).toEqual(500);

  //   //   await deleteCase(deaApiUrl ?? fail(), jsonResp.ulid ?? fail(), creds, region);
  //   // }, 10000);
});
