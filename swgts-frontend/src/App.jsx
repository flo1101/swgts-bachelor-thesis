import "./App.css";
import React, { useState } from "react";
import UploadView from "./components/UploadView/UploadView.jsx";
import ProgressMonitor from "./components/ProgressMonitor.jsx";
import InfoDialog from "./components/InfoDialog.jsx";
import { useGetServerConfig } from "./hooks";
import { uploadFASTQ } from "./data/FASTQProcessing";

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
      {uploading ? (
        <ProgressMonitor
          dialogCallback={dialogCallback}
          bufferSize={bufferSize}
          total={total}
          progress={progress}
          filtered={filtered}
          bufferFill={bufferFill}
        />
      ) : (
        <UploadView
          dialogCallback={dialogCallback}
          initiateUpload={initiateUpload}
        />
      )}
      {showDialog && (
        <InfoDialog text={dialogText} closeInfoDialog={closeDialog} />
      )}
    </div>
  );
};

export default App;
