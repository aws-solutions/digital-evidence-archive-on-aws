/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import * as fs from 'fs';
import * as cheerio from 'cheerio';

export const generateSri = (outDir: string, algorithm: 'sha384' | 'sha512') => {
  const results: string[] = [];
  const files = fs.readdirSync(outDir);
  files
    .filter((file) => file.endsWith('.html'))
    .forEach((file) => {
      const targetFile = `${outDir}/${file}`;
      const $ = cheerio.load(fs.readFileSync(targetFile));
      $('script')
        .get()
        .forEach((it) => {
          const scriptSrc = it.attribs['src'];
          if (scriptSrc) {
            const srcLoc = scriptSrc.substring(scriptSrc.lastIndexOf('/ui/') + 4, scriptSrc.length);
            const scriptContents = fs.readFileSync(`${outDir}/${srcLoc}`);
            const hash = crypto.createHash(algorithm).update(scriptContents).digest('base64');
            const sri = `${algorithm}-${hash}`;
            it.attribs['integrity'] = sri;
            results.push(sri);
          }
        });

      fs.writeFileSync(targetFile, $.html());
    });
  return results;
};
