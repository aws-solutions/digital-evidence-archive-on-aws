/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

const MALFORMED_JSON_PREFIX = 'Malformed Event';
const KINESIS_PUT_ERROR_PREFIX = 'Failed to put Kinesis records';

const ErrorPrefixes = {
  MALFORMED_JSON_PREFIX,
  KINESIS_PUT_ERROR_PREFIX,
};

export default ErrorPrefixes;
