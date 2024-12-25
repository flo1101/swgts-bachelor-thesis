import "./App.css";
import https from "https-browserify";
import React, { useState } from "react";
import LoadDataView from "./components/LoadDataView.jsx";
import { uploadFASTQ } from "./data/FASTQProcessing.js";
import ProgressMonitor from "./components/ProgressMonitor.jsx";
import InfoDialog from "./components/InfoDialog.jsx";
import GitInfo from "react-git-info/macro";
import logo from "./logo.png"; // relative path to image
import githubmark from "./githubmark.png";
import { useGetServerConfig } from "./hooks"; // relative path to image

// Environment variables
export const SWGTS_API_BASE_URL = process.env.REACT_APP_API_URL;
export const SSL_CRT_FILE = process.env.SSL_CRT_FILE;
export const SSL_KEY_FILE = process.env.SSL_KEY_FILE;

// Disable SSL verification for locally running frontend
const httpsAgent = new https.Agent({
  cert: SSL_KEY_FILE,
  key: SSL_CRT_FILE,
});

// GIT
const gitInfo = GitInfo();

const App = () => {
  const [filtered, setFiltered] = useState(0);

  const [dialogText, setDialogText] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  // Buffer
  const [bufferFill, setBufferFill] = useState(0);

  // Upload
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const {
    serverConfig,
    serverConfigIsLoading,
    serverConfigError,
    fetchServerConfig,
  } = useGetServerConfig();

  const { bufferSize } = serverConfig;

  const dialogCallback = (newText) => {
    setShowDialog(true);
    setDialogText(newText);
  };

  const updateProgress = (progress) => {
    setProgress((prevProgress) => prevProgress + progress);
  };

  const closeDialog = () => {
    setShowDialog(false);
  };

  const initiateUpload = (fileList, download) => {
    setUploading(true);
    setFiltered(0);
    setProgress(0);
    uploadFASTQ(
      fileList,
      download,
      updateProgress,
      setTotal,
      setBufferFill,
      setFiltered,
      dialogCallback,
      bufferSize,
    ).then(() => setUploading(false));
  };

  return (
    <div className="App">
      <br />
      <img src={logo} width="128" />
      <br />
      <a href="https://github.com/AlBi-HHU/swgts">
        <img src={githubmark} width="64" />
      </a>
      <br />
      {!uploading && (
        <LoadDataView
          className="ldv"
          dialogCallback={dialogCallback}
          initiate_upload={initiateUpload}
        />
      )}
      {showDialog && (
        <InfoDialog text={dialogText} closeInfoDialog={closeDialog} />
      )}
      {uploading && (
        <ProgressMonitor
          dialogCallback={dialogCallback}
          buffer_size={bufferSize}
          total={total}
          progress={progress}
          filtered={filtered}
          buffer_fill={bufferFill}
        />
      )}
    </div>
  );
};

export default App;
