/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

'use strict';

const expect = require('chai').expect;

const lib = require('../index.js');

describe('index', function() {
  beforeEach(() => {
    process.env.AWS_SDK_USER_AGENT = '{ "cutomerAgent": "fakedata" }'
  });

  it('should return greeting with successful library Hello respond response', () => {
    const event = { path: "/samplepath" };
    // WHEN
    const handler = lib.handler(event);
    // THEN
    handler.then((res) => {
      console.log(res);
      expect(res.statusCode).to.equal(200);
    }).catch((err) => {
      console.log(err);
      throw new Error(err);
    });
  });

  afterEach(() => {
    delete process.env.AWS_SDK_USER_AGENT
  });
});