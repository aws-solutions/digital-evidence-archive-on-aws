/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { Html, Head, Main, NextScript } from 'next/document';

const Document = () => {
  // can remove this file when doing localization
  return (
    <Html lang="en-US">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
};

export default Document;
