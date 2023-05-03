/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FileUpload from '../../../src/components/common-components/FileUpload';
import wrapper from '@cloudscape-design/components/test-utils/dom';

const fileName = 'hello.world';
const fileItem = {
  name: fileName,
  size: 100,
  type: 'file',
  relativePath: `folder_one/${fileName}`,
  file: (resolve: any) => resolve(fileItem),
  isFile: true,
};

const directoryEntry = {
  webkitGetAsEntry: () => ({
    name: 'folder_one',
    createReader: () => ({
      readEntries: (resolve: any) => resolve([fileItem]),
    }),
    isDirectory: true,
  }),
};
const items = [directoryEntry];

function createDragEvent(type: string) {
  const event = new CustomEvent(type, { bubbles: true });
  (event as any).dataTransfer = {
    items: items,
  };
  return event;
}

describe('File Upload', () => {
  test('fires onChange on drop', async () => {
    const onChange = jest.fn();
    const { container } = render(<FileUpload onChange={onChange} value={[fileItem]} />);
    const dropzone = container.querySelector('.dropzone')!;

    fireEvent(dropzone, createDragEvent('dragover'));
    fireEvent(dropzone, createDragEvent('dragleave'));
    fireEvent(dropzone, createDragEvent('drop'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  test('fires onChange on remove item', async () => {
    const onChange = jest.fn();
    const { container } = render(<FileUpload onChange={onChange} value={[fileItem]} />);

    const fileList = wrapper(container).findTokenGroup()!.findTokens()!;
    expect(fileList).toBeTruthy();

    // fire dismiss button.
    fileList[0].findDismiss()!.click();

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
