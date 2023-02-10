/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */


const teardown = (): void => {
    if (process.env.DYNAMODB_PID) {
        const pid = parseInt(process.env.DYNAMODB_PID)
        process.kill(pid)
    }
}

export default teardown;