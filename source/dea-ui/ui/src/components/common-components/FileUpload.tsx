/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { Button, TokenGroup } from '@cloudscape-design/components';
import { ChangeEvent, useEffect, useRef } from 'react';
import { fileOperationsLabels, fileUploadLabels } from '../../common/labels';
import { FileWithPath, formatFileSize, toFileWithPath } from '../../helpers/fileHelper';
import styles from '../../styles/FileUpload.module.scss';

export interface FileUploadProps {
  onChange: (files: FileWithPath[]) => void;
  value: ReadonlyArray<FileWithPath>;
  disabled?: boolean;
}

function FileUpload(props: FileUploadProps) {
  const { onChange, value, disabled } = props;
  const uploadInputRef = useRef<HTMLInputElement>(null);
  // Set HTMLInputElement: webkitdirectory property
  useEffect(() => {
    if (uploadInputRef.current !== null) {
      uploadInputRef.current.setAttribute('directory', '');
      uploadInputRef.current.setAttribute('webkitdirectory', '');
    }
  }, [uploadInputRef]);

  const onUploadButtonClick = () => uploadInputRef.current?.click();
  const onUploadInputChange = ({ target }: ChangeEvent<HTMLInputElement>) => {
    onChange(target.files ? Array.from(target.files).map((file) => toFileWithPath(file)) : []);
  };
  const onFileRemove = (removeFileIndex: number) => {
    const newValue = value.filter((_, fileIndex) => fileIndex !== removeFileIndex);
    onChange(Array.from(newValue));
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none';
    }
  };
  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const files = await getFilesDataTransferItems(event.dataTransfer.items);
    onChange(Array.from(files));
  };

  const traverseFileTreePromise = (item: FileSystemEntry, path: string, files: FileWithPath[]) => {
    return new Promise((resolve) => {
      if (item.isFile) {
        (item as FileSystemFileEntry).file((file: File) => {
          const relativePath = path + '/' + file.name;
          files.push(toFileWithPath(file, relativePath));
          resolve(file);
        });
      } else if (item.isDirectory) {
        const dirReader = (item as FileSystemDirectoryEntry).createReader();
        dirReader.readEntries((entries) => {
          const entriesPromises = [];
          for (const entry of entries) {
            entriesPromises.push(traverseFileTreePromise(entry, path + '/' + item.name, files));
          }
          resolve(Promise.all(entriesPromises));
        });
      }
    });
  };

  const getFilesDataTransferItems = async (
    dataTransferItems: DataTransferItemList
  ): Promise<FileWithPath[]> => {
    const files: FileWithPath[] = [];
    return new Promise((resolve, reject) => {
      const entriesPromises = [];
      for (const item of dataTransferItems) {
        const fileSystemEntry = item.webkitGetAsEntry();
        if (!fileSystemEntry) {
          reject(`${item} is not a File`);
        } else {
          entriesPromises.push(traverseFileTreePromise(fileSystemEntry, '', files));
        }
      }
      Promise.all(entriesPromises)
        .then(() => {
          resolve(files);
        })
        .catch((e) => reject(e));
    });
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid="dropzone"
      className={styles['dropzone']}
    >
      <span>{fileOperationsLabels.selectFileSubtext}</span>
      <input
        ref={uploadInputRef}
        type="file"
        data-testid="file-select"
        onChange={onUploadInputChange}
        disabled={disabled}
        multiple
        className={styles['upload-input']}
      />
      <Button iconName="upload" formAction="none" onClick={onUploadButtonClick}>
        {fileUploadLabels.chooseFilesLabel}
      </Button>
      <TokenGroup
        onDismiss={({ detail: { itemIndex } }) => onFileRemove(itemIndex)}
        items={value.map((file) => ({ label: file.relativePath, tags: [formatFileSize(file.size)] }))}
        alignment="vertical"
        limit={3}
      />
    </div>
  );
}

export default FileUpload;
