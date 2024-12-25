import React, { useState } from "react";
import { Box, Button, FormControlLabel, Switch } from "@mui/material";

const ALLOWED_EXTENSIONS = [".fastq.gz", ".fq.gz", ".fastq", ".fq"];

const LoadDataView = ({ dialogCallback, initiateUpload, disabled }) => {
  const [downloadFiles, setDownloadFiles] = useState(false);
  const [inputFiles, setInputFiles] = useState([]);

  const updateFileList = (files) => {
    if (
      [...files].every((file) =>
        ALLOWED_EXTENSIONS.some((extension) => file.name.endsWith(extension)),
      ) &&
      files.length <= 2
    ) {
      setInputFiles([...files]);
      return true;
    } else {
      dialogCallback(
        "Only one or two files can be uploaded, allowed extensions are: " +
          ALLOWED_EXTENSIONS.join(", "),
      );
      return false;
    }
  };

  const dragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add("highlight");
  };

  const dragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add("highlight");
  };

  const dragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove("highlight");
  };

  const drop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove("highlight");
    if (event.dataTransfer.files !== null) {
      updateFileList(event.dataTransfer.files);
    }
  };

  const click = (event) => {
    if (updateFileList(event.target.files) === false) {
      event.target.value = "";
    }
  };

  return (
    <>
      <div
        id="drop-area"
        onDragEnter={dragEnter}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
      >
        <form className="drop-form">
          <p>Drag and drop files</p>
          <input
            id="fileElem"
            type="file"
            multiple
            onChange={click}
            accept={ALLOWED_EXTENSIONS.join(",")}
          />
          <label className="upload-button" htmlFor="fileElem">
            Select files
          </label>
        </form>
      </div>

      {inputFiles.length !== 0
        ? "Selected Files: " + inputFiles.map((x) => x.name).join("\t")
        : null}

      <Box
        className="loadDataView"
        style={disabled ? { pointerEvents: "none", opacity: "0.4" } : {}}
      >
        <Button
          id={"upload_button"}
          variant="contained"
          onClick={() => {
            if (inputFiles.length === 0) {
              dialogCallback(`Please select a file for uploading!`);
              return;
            }
            initiateUpload(Array.from(inputFiles), downloadFiles);
          }}
        >
          Upload File
        </Button>

        <FormControlLabel
          control={
            <Switch onChange={(e, checked) => setDownloadFiles(checked)} />
          }
          label="Download filtered files"
        />
      </Box>
    </>
  );
};

export default LoadDataView;
