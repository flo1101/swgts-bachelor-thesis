import React, { useState } from "react";
import "./style.css";
import DropArea from "./components/DropArea";
import Button from "../Button/Button";
import Checkbox from "../Checkbox/Checkbox";
import SelectedFiles from "./components/SelectedFiles";
import UploadInfo from "./components/UploadInfo";

const UploadView = ({ dialogCallback, initiateUpload }) => {
  const [files, setFiles] = useState([1, 2]);
  const [downloadFiles, setDownloadFiles] = useState(false);
  const disableUpload = files.length <= 0;

  const startUpload = () => initiateUpload(files, downloadFiles);

  const deleteFile = (name) => {};

  return (
    <div className="upload-view">
      <h1>Upload to server</h1>
      <DropArea dialogCallback={dialogCallback} setFiles={setFiles}>
        <UploadInfo />
        <SelectedFiles files={files} deleteFile={deleteFile} />
        <Button
          className={"start-upload-button"}
          disabled={disableUpload}
          label={"Start upload"}
          onClick={startUpload}
        />
        <Checkbox
          className={"download-files-checkbox"}
          val={downloadFiles}
          set={setDownloadFiles}
          disabled={disableUpload}
          label={"Download filtered files"}
        />
      </DropArea>
    </div>
  );
};

export default UploadView;
