/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { Button, SpaceBetween, TokenGroup } from '@cloudscape-design/components';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { fileOperationsLabels, fileUploadLabels } from '../../common/labels';
import {
  FileWithPath,
  formatFileSize,
  removeFileNameFromPath,
  toFileWithPath,
} from '../../helpers/fileHelper';
import styles from '../../styles/FileUpload.module.scss';

export interface FileUploadProps {
  onChange: (files: FileWithPath[]) => void;
  value: ReadonlyArray<FileWithPath>;
  disabled?: boolean;
}

function FileUpload(props: FileUploadProps) {
  const { onChange, value, disabled } = props;
  const [isDropzoneHovered, setDropzoneHovered] = useState(false);
  const uploadFilesInputRef = useRef<HTMLInputElement>(null);
  const uploadFolderInputRef = useRef<HTMLInputElement>(null);
  // Set HTMLInputElement: webkitdirectory property
  useEffect(() => {
    if (uploadFolderInputRef.current !== null) {
      uploadFolderInputRef.current.setAttribute('directory', '');
      uploadFolderInputRef.current.setAttribute('webkitdirectory', '');
    }
  }, [uploadFolderInputRef]);

  const onUploadInputChange = ({ target }: ChangeEvent<HTMLInputElement>) => {
    onChange(
      target.files
        ? Array.from(target.files).map((file) =>
            toFileWithPath(file, removeFileNameFromPath(file.webkitRelativePath))
          )
        : []
    );
  };
  const onFileRemove = (removeFileIndex: number) => {
    const newValue = value.filter((_, fileIndex) => fileIndex !== removeFileIndex);
    onChange(Array.from(newValue));
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDropzoneHovered(true);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDropzoneHovered(false);
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'none';
    }
  };
  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setDropzoneHovered(false);
    const files = await getFilesDataTransferItems(event.dataTransfer.items);
    onChange(Array.from(files));
  };

  const traverseFileTreePromise = (item: FileSystemEntry, path: string, files: FileWithPath[]) => {
    return new Promise((resolve) => {
      if (item.isFile) {
        (item as FileSystemFileEntry).file((file: File) => {
          const relativePath = path + '/';
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
      className={
        isDropzoneHovered ? `${styles['dropzone']} ${styles['dropzone-hovered']}` : styles['dropzone']
      }
    >
      <span>{fileUploadLabels.dragAndDropFolderLabel}</span>
      <SpaceBetween direction="horizontal" size="xs">
        <div>
          <input
            ref={uploadFolderInputRef}
            type="file"
            data-testid="folder-select"
            onChange={onUploadInputChange}
            disabled={disabled}
            className={styles['upload-input']}
          />
          <Button
            data-testid="single-folder-button"
            iconName="folder"
            formAction="none"
            onClick={() => uploadFolderInputRef.current?.click()}
          >
            {fileUploadLabels.chooseFolderLabel}
          </Button>
        </div>
        <div>
          <input
            ref={uploadFilesInputRef}
            type="file"
            data-testid="file-select"
            onChange={onUploadInputChange}
            disabled={disabled}
            multiple
            className={styles['upload-input']}
          />
          <Button
            data-testid="multiple-files-button"
            iconName="file"
            formAction="none"
            onClick={() => uploadFilesInputRef.current?.click()}
          >
            {fileUploadLabels.chooseFilesLabel}
          </Button>
        </div>
      </SpaceBetween>

      <TokenGroup
        onDismiss={({ detail: { itemIndex } }) => onFileRemove(itemIndex)}
        items={value.map((file) => ({
          label: file.relativePath + file.name,
          tags: [formatFileSize(file.size)],
        }))}
        alignment="vertical"
        limit={3}
      />
      <span>{fileOperationsLabels.selectFileSubtext}</span>
    </div>
  );
}

export default FileUpload;
