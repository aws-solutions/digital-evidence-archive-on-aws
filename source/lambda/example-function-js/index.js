/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License Version 2.0 (the 'License'). You may not use this file except in compliance     *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/                                                                               *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

const CustomConfig = require('aws-nodesdk-custom-config');
const AWS = require('aws-sdk');
exports.handler = async function(event) {
  // You can update the config for specific services by passing the configuration to the AWS service
  const awsCustomConfig = CustomConfig.customAwsConfig();
  const s3 = new AWS.S3(awsCustomConfig); // this service client instance of the AWS service returned will use the custom config


  /**
   * To run local test install the layer as a devDependency
   * include the following as jest config either directly in the package.json or jest.config.js
   * 1. package.json:
   *    "jest": {
   *      "modulePaths": [
   *        "<rootDir>/../layers/"
   *      ]
   *    }
   * 2. jest.config.js
   *      module.exports = {
   *        modulePaths: [
   *          "<rootDir>/../layers/"
   *        ]
   *      }
   * The downside of this approach is your favourite editor will not support auto-complete of function/ method
   * or variable names
   *
   * OR
   * npm install --save-dev ../layers/aws-nodesdk-custom-config
   *
   * This option will allow for your favourite editor to support auto-completion
   *
   * OR
   * install it globally so that it is not in the package.json of your lambda module (NOT recommended as an option)
   * npm install -g ../layers/aws-nodesdk-custom-config
   *
   */
  console.log("request:", JSON.stringify(event, undefined, 2));
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/plain" },
    body: `Hello, AWS Solutions Constructs! You've hit ${event.path}\n`
  };
};