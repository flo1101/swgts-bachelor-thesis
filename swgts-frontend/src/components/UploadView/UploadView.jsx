import React, { useState } from "react";
import "./style.css";
import DropArea from "./components/DropArea";
import Button from "../Button/Button";
import Checkbox from "../Checkbox/Checkbox";
import SelectedFiles from "./components/SelectedFiles";
import UploadInfo from "./components/UploadInfo";
import { useHandleUpload } from "../../hooks/uploadHooks";
import ProgressMonitor from "../ProgressMonitor/ProgressMonitor";
import { useHandleSocketUpload } from "../../hooks/socketHooks";

export const ALLOWED_EXTENSIONS = [".fastq.gz", ".fq.gz", ".fastq", ".fq"];

const UploadView = ({ bufferSize }) => {
  const [files, setFiles] = useState([]);
  const [downloadFiles, setDownloadFiles] = useState(false);
  const disableUpload = files.length <= 0;

  const { startUpload, uploadStatus, readsTotal, readsProgressed, bufferFill } =
    useHandleUpload(files, downloadFiles, bufferSize);

  const { startSocketUpload, resetUpload } = useHandleSocketUpload(
    files,
    downloadFiles,
  );

  const initNewUpload = () => {
    setFiles([]);
    resetUpload();
  };

  const addFiles = (files) => {
    if (
      [...files].every((file) =>
        ALLOWED_EXTENSIONS.some((extension) => file.name.endsWith(extension)),
      ) &&
      files.length + files.length <= 2
    ) {
      setFiles((prev) => [...prev, ...files]);
      return true;
    } else {
      return false;
    }
  };

  const deleteFile = (name) => {
    if (files.length === 0) return;
    const fileIndex = files.findIndex((file) => file?.name === name);
    if (fileIndex === -1) return;
    setFiles((files) => {
      const newFiles = [...files];
      newFiles.splice(fileIndex, 1);
      return newFiles;
    });
  };

  return (
    <div className="upload-view">
      {uploadStatus ? (
        <ProgressMonitor
          uploadStatus={uploadStatus}
          bufferSize={bufferSize}
          readsTotal={readsTotal}
          readsProgressed={readsProgressed}
          bufferFill={bufferFill}
          initNewUpload={initNewUpload}
        />
      ) : (
        <>
          <h1>Upload to server</h1>
          <DropArea addFiles={addFiles}>
            <UploadInfo addFiles={addFiles} />
            <SelectedFiles files={files} deleteFile={deleteFile} />
            <div className="upload-button-checkbox">
              <Button
                className={"start-upload-button"}
                disabled={disableUpload}
                label={"Start upload"}
                disabledLabel={"No files selected"}
                onClick={startUpload}
              />
              <Button
                className={"start-upload-button"}
                label={"Start socket upload"}
                disabled={disableUpload}
                disabledLabel={"No files selected"}
                onClick={startSocketUpload}
              />
              <Checkbox
                className={"download-files-checkbox"}
                val={downloadFiles}
                set={setDownloadFiles}
                label={"Download filtered files"}
              />
            </div>
          </DropArea>
        </>
      )}
    </div>
  );
};

export default UploadView;
