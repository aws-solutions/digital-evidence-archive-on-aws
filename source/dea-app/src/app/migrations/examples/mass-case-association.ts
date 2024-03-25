/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

/* README
This is an example script for how to automatically create cases given a list of data vault directories from a CSV file. Refer to ExampleCsv.csv for an example on how to format the cases to create from your datavault directories.

To run the script, please look at package.json in dea-app.
Use the following command:
mass-case:only --username <username> --password <password> --datavaultulid <dataVaultUlid> --csvpath <your csv path>

For production use, you'll need to replace the credentials login with getting the Oauth2 cookie from your IDP provider if you are not using cognito.

Please note, this is only an example, adjustments will need to be made for production use.
*/
import * as fs from 'fs';
import * as path from 'path';
import { Credentials } from 'aws4-axios';
import { parse } from 'csv-parse';
import minimist from 'minimist';
import { getRequiredEnv } from '../../../lambda-http-helpers';
import { Oauth2Token } from '../../../models/auth';
import { DeaDataVaultFile } from '../../../models/data-vault-file';
import CognitoHelper from '../../../test-e2e/helpers/cognito-helper';
import { callDeaAPIWithCreds } from '../../../test-e2e/resources/test-helpers';

const args = minimist(process.argv.slice(2));

const massCaseAssociation = async (
  directories: string[],
  username: string,
  password: string,
  datavaultulid: string
) => {
  let creds: Credentials;
  let idToken: Oauth2Token;
  const cognitoHelper: CognitoHelper = new CognitoHelper(password);

  const deaApiUrl = getRequiredEnv('DEA_API_URL');

  for (const directory of directories) {
    [creds, idToken] = await cognitoHelper.getCredentialsForUser(username); // Refresh tokens per directory
    const fileUlids = await getFileUlids(idToken, creds, deaApiUrl, directory, datavaultulid);

    // Create case and return case ulid
    const caseName = getDirectoryName(directory);
    const currentCase = await createCase(caseName, idToken, creds, deaApiUrl);

    // Break down file ulids into chunks, max 300 per case association
    const fileUlidsChunks = getFileUlidChunks(fileUlids, 300);
    for (const fileUlids of fileUlidsChunks) {
      await associateFiles(currentCase.ulid, fileUlids, datavaultulid, idToken, creds, deaApiUrl);
    }

    console.log(`Case associations complete for case ${caseName}`);
  }
};

const getFileUlidChunks = (fileUlids: string[], chunkSize: number): string[][] => {
  const chunks: string[][] = [];

  for (let i = 0; i < fileUlids.length; i += chunkSize) {
    const chunk = fileUlids.slice(i, i + chunkSize);
    chunks.push(chunk);
  }

  return chunks;
};

const parseCsv = async (csvpath: string) => {
  const csvFilePath = path.resolve(__dirname, csvpath);
  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });

  return new Promise<string[]>((resolve, reject) => {
    let directories: string[] = [];

    parse(
      fileContent,
      {
        delimiter: ',',
        skip_empty_lines: true,
      },
      (error, directory) => {
        if (error) {
          console.error(error);
          reject(error);
          return;
        }
        directories = directory;
      }
    );

    setTimeout(() => {
      resolve(directories);
    }, 10000);
  });
};

const getDirectoryName = (filePath: string) => {
  const regExp = new RegExp(/\/([^/]+)\/$/);
  const regMatch = String(filePath).match(regExp);
  let caseName = '';

  if (regMatch && regMatch[1]) {
    caseName = regMatch[1];
  }

  return caseName;
};

const associateFiles = async (
  caseUlid: string,
  fileUlids: string[],
  dataVaultUlid: string,
  idToken: Oauth2Token,
  creds: Credentials,
  deaApiUrl: string
) => {
  const response = await callDeaAPIWithCreds(
    `${deaApiUrl}datavaults/${dataVaultUlid}/case-associations`,
    'POST',
    idToken,
    creds,
    {
      caseUlids: [caseUlid],
      fileUlids,
    }
  );

  // Check if the case creation was successful
  if (response.status === 200) {
    console.log(`files associated successfully with case ${caseUlid}`);
  } else {
    console.error('Failed to associate files with case:', response.data);
  }

  return response.data;
};

const createCase = async (caseName: string, idToken: Oauth2Token, creds: Credentials, deaApiUrl: string) => {
  const response = await callDeaAPIWithCreds(`${deaApiUrl}cases`, 'POST', idToken, creds, {
    name: caseName,
    status: 'ACTIVE',
  });

  // Check if the case creation was successful
  if (response.status === 200) {
    console.log(`case ${caseName} was created successfully`);
  } else {
    console.error('Failed to create case:', response.data);
  }

  return response.data;
};

const getFileUlids = async (
  idToken: Oauth2Token,
  creds: Credentials,
  deaApiUrl: string,
  directory: string,
  datavaultulid: string,
  nextToken?: string
): Promise<string[]> => {
  let fileUlids: string[] = [];

  try {
    let url = `${deaApiUrl}datavaults/${datavaultulid}/files?filePath=${directory}`.replace(
      /[^\x20-\x7E]/g,
      ''
    );

    if (nextToken) {
      url += `&next=${encodeURIComponent(nextToken)}`;
    }

    const getResponse = await callDeaAPIWithCreds(url, 'GET', idToken, creds);
    const files: DeaDataVaultFile[] = getResponse.data.files;

    for (const file of files) {
      if (file.isFile) {
        fileUlids.push(file.ulid);
      } else {
        // folder entry, get ulids inside folder
        const directoryFiles = await getFileUlids(
          idToken,
          creds,
          deaApiUrl,
          `${file.filePath}${file.fileName}/`,
          datavaultulid
        );
        fileUlids = fileUlids.concat(directoryFiles);
      }
    }

    // If there's a next token, recursively fetch more files
    if (getResponse.data.next) {
      const moreFileUlids = await getFileUlids(
        idToken,
        creds,
        deaApiUrl,
        directory,
        datavaultulid,
        getResponse.data.next
      );
      fileUlids = fileUlids.concat(moreFileUlids);
    }
  } catch (error) {
    console.error('Error fetching file ulids:', error);
  }

  return fileUlids;
};

const createCases = async (username: string, password: string, datavaultulid: string, csvpath: string) => {
  let directories: string[] = [];
  try {
    const response = await parseCsv(csvpath);
    directories = [...new Set(response)]; // removes duplicates
  } catch (error) {
    console.error(error);
  }
  await massCaseAssociation(directories, username, password, datavaultulid);
};

const verifyRequiredParam = (name: string) => {
  if (!args[name]) {
    console.error(`required parameter '--${name}' is unspecified`);
    process.exit(1);
  }
};

verifyRequiredParam('username');
verifyRequiredParam('password');
verifyRequiredParam('datavaultulid');
verifyRequiredParam('csvpath');

void createCases(args.username, args.password, args.datavaultulid, args.csvpath);
