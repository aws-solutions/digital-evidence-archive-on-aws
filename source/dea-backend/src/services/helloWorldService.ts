/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

export default class HelloWorldService {
  public async sayHello(): Promise<string> {
    return "Hello DEA!";
  }

  public async sayBye(): Promise<string> {
    return "Bye DEA!";
  }
}
